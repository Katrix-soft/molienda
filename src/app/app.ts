import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

interface Item {
  id: number;
  name: string;
  price: number;
  desc?: string;
  tag?: string;
}

interface Section {
  type: 'promos' | 'list';
  items: Item[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  // Estado de datos
  readonly menuData = signal<Record<string, Section>>({});
  readonly cats = computed(() => Object.keys(this.menuData()));
  
  // Estado de UI
  readonly activeCat = signal<string>('');
  readonly search = signal<string>('');
  readonly loading = signal<boolean>(true);
  
  // Estado de Admin
  readonly isAdmin = signal<boolean>(false);
  readonly adminToken = signal<string>('');
  loginPassword = '';
  editingItem = signal<Item | null>(null);
  editingItemDescParts = signal<string[]>([]);
  editingCategory = signal<string | null>(null);
  newCategoryName = '';
  readonly isEditMode = signal<boolean>(false);
  readonly showCategories = signal<boolean>(false);
  readonly canUseBiometrics = signal<boolean>(window.PublicKeyCredential !== undefined);
  hasBiometrics = signal<boolean>(false);

  // Notificaciones
  alertMessage = signal<string | null>(null);
  alertType = signal<'success' | 'error' | 'info'>('info');
  confirmMessage = signal<string | null>(null);
  confirmTitle = signal<string>('Confirmación');
  confirmIcon = signal<string>('❓');
  confirmCallback: (() => void) | null = null;

  // Herramientas Admin
  showInflationModal = signal<boolean>(false);
  inflationPercentage = signal<number>(0);
  showPdfModal = signal<boolean>(false);
  showQrModal = signal<boolean>(false);
  hasPdf = signal<boolean>(false);
  isUploading = signal<boolean>(false);

  // Computed properties
  readonly searchMatches = computed(() => {
    const s = this.search().trim().toLowerCase();
    if (!s) return null;

    const matches: { cat: string; type: string; items: Item[] }[] = [];
    let totalFound = 0;
    const data = this.menuData();

    for (const cat of this.cats()) {
      const sec = data[cat];
      const items = sec.items.filter(i => 
        i.name.toLowerCase().includes(s) || (i.desc || '').toLowerCase().includes(s)
      );
      if (items.length) {
        totalFound += items.length;
        matches.push({ cat, type: sec.type, items });
      }
    }
    return { matches, totalFound };
  });

  readonly currentContent = computed(() => {
    if (this.search().trim()) return null;
    const cat = this.activeCat();
    if (!cat) return null;
    const data = this.menuData();
    if (!data[cat]) return null;
    return { cat, type: data[cat].type, items: data[cat].items };
  });

  ngOnInit() {
    this.checkAdminUrl();
    this.fetchMenu();
    this.checkBiometrics();
    this.checkPdf();

    // Debugging global errors
    window.onerror = (msg, url, line, col, error) => {
      this.showAlert(`Error Global: ${msg}`, 'error');
      return false;
    };
    window.onunhandledrejection = (event) => {
      this.showAlert(`Promesa Fallida: ${event.reason}`, 'error');
    };
  }

  checkAdminUrl() {
    if (window.location.search.includes('belen=true')) {
      const savedToken = localStorage.getItem('adminToken');
      if (savedToken) {
        this.adminToken.set(savedToken);
        this.isAdmin.set(true);
      }
    }
  }

  getPdfUrl() {
    const host = window.location.hostname === 'localhost' && window.location.port === '4200' ? 'http://localhost:3000' : '';
    return `${host}/public/menu_completo.pdf`;
  }

  async checkPdf() {
    try {
      const host = window.location.hostname === 'localhost' && window.location.port === '4200' ? 'http://localhost:3000' : '';
      const res = await fetch(`${host}/api/menu-pdf-check`);
      const data = await res.json();
      this.hasPdf.set(data.exists);
    } catch (e) {
      this.hasPdf.set(false);
    }
  }

  async fetchMenu() {
    try {
      this.loading.set(true);
      const host = window.location.hostname === 'localhost' && window.location.port === '4200' 
        ? 'http://localhost:3000' 
        : '';
      const res = await fetch(`${host}/api/menu`);
      const data = await res.json();
      this.menuData.set(data);
      if (Object.keys(data).length > 0) {
        this.activeCat.set(Object.keys(data)[0]);
      }
    } catch (e) {
      console.error("Error fetching menu", e);
    } finally {
      this.loading.set(false);
    }
  }

  setCat(c: string) {
    this.activeCat.set(c);
    this.search.set('');
    this.showCategories.set(false); // Close mobile menu
    
    // Auto-scroll carousel to active item
    setTimeout(() => {
      const activeBtn = document.querySelector('.cat-btn.active');
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 50);
  }

  doSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    this.search.set(val);

    if (val.trim().toLowerCase() === 'belen') {
      if (this.canUseBiometrics() && this.hasBiometrics()) {
        // Auto-trigger biometric login
        setTimeout(() => {
          this.biometricLogin();
        }, 300);
      }
    }
  }

  fmtPrice(p: number, desc?: string): string {
    if (!p) return 'Consultar';
    return '$' + p.toLocaleString('es-AR');
  }

  getDescParts(desc?: string): string[] {
    if (!desc) return [];
    return desc.split('·').map(s => s.trim()).filter(s => s);
  }

  checkBiometrics() {
    if (!this.canUseBiometrics()) return;
    const localHasBio = localStorage.getItem('hasBiometrics') === 'true';
    this.hasBiometrics.set(localHasBio);
  }

  // --- Notificaciones ---
  showAlert(msg: string, type: 'success' | 'error' | 'info' = 'info') {
    this.alertType.set(type);
    this.alertMessage.set(msg);
    setTimeout(() => this.alertMessage.set(null), 4000);
  }

  showConfirm(msg: string, callback: () => void, title = 'Confirmación', icon = '❓') {
    this.confirmMessage.set(msg);
    this.confirmTitle.set(title);
    this.confirmIcon.set(icon);
    this.confirmCallback = callback;
  }

  onConfirm(yes: boolean) {
    if (yes && this.confirmCallback) {
      this.confirmCallback();
    }
    this.confirmMessage.set(null);
    this.confirmCallback = null;
  }

  // --- Admin Funciones ---
  
  async login() {
    try {
      const host = window.location.hostname === 'localhost' && window.location.port === '4200' ? 'http://localhost:3000' : '';
      const res = await fetch(`${host}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: this.loginPassword })
      });
      const data = await res.json();
      if (data.success) {
        this.adminToken.set(data.token);
        this.isAdmin.set(true);
        localStorage.setItem('adminToken', data.token);
        this.loginPassword = '';
        this.search.set(''); // Limpiar la busqueda ("belen") para ver el menu
        
        // APB: Preguntar por biometría si no está configurada
        if (this.canUseBiometrics() && !this.hasBiometrics()) {
          setTimeout(() => {
            this.showConfirm(
              '¿Querés activar el acceso con huella/FaceID para entrar más rápido la próxima vez?', 
              () => this.registerBiometrics(),
              'Acceso Rápido',
              '🔐'
            );
          }, 1000);
        }
      } else {
        this.showAlert("Contraseña incorrecta", "error");
      }
    } catch (e) {
      console.error(e);
      this.showAlert("Error en el servidor", "error");
    }
  }

  logout() {
    this.adminToken.set('');
    this.isAdmin.set(false);
    this.isEditMode.set(false);
    localStorage.removeItem('adminToken');
    this.showAlert("Modo edición desactivado", "info");
  }

  toggleEditMode() {
    this.isEditMode.update(v => !v);
  }

  startEdit(item: Item) {
    if (!this.isAdmin()) return;
    this.editingItem.set({ ...item });
    if (item.desc) {
      this.editingItemDescParts.set(item.desc.split('·').map(s => s.trim()).filter(s => s));
    } else {
      this.editingItemDescParts.set(['']); // Start with one empty part
    }
  }

  addDescPart() {
    this.editingItemDescParts.update(p => [...p, '']);
  }

  updateDescPart(index: number, event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.editingItemDescParts.update(p => {
      const newP = [...p];
      newP[index] = val;
      return newP;
    });
  }

  removeDescPart(index: number) {
    this.editingItemDescParts.update(p => {
      const newP = [...p];
      newP.splice(index, 1);
      return newP;
    });
  }

  cancelEdit() {
    this.editingItem.set(null);
    this.editingItemDescParts.set([]);
  }

  async saveEdit() {
    const item = this.editingItem();
    if (!item) return;

    const parts = this.editingItemDescParts().map(p => p.trim()).filter(p => p);
    item.desc = parts.length > 0 ? parts.join(' · ') : undefined;

    try {
      const host = window.location.hostname === 'localhost' && window.location.port === '4200' ? 'http://localhost:3000' : '';
      const res = await fetch(`${host}/api/menu/item/${item.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.adminToken()}`
        },
        body: JSON.stringify({
          name: item.name,
          price: item.price,
          desc: item.desc,
          tag: item.tag
        })
      });
      const data = await res.json();
      if (data.success) {
        await this.fetchMenu(); // Recargar menú
        this.editingItem.set(null);
      }
    } catch (e) {
      console.error("Error al guardar", e);
      this.showAlert("Hubo un error al guardar", "error");
    }
  }

  startEditCategory(cat: string) {
    if (!this.isAdmin()) return;
    this.editingCategory.set(cat);
    this.newCategoryName = cat;
  }

  cancelEditCategory() {
    this.editingCategory.set(null);
  }

  async saveEditCategory() {
    const oldName = this.editingCategory();
    if (!oldName || !this.newCategoryName.trim()) return;

    try {
      const host = window.location.hostname === 'localhost' && window.location.port === '4200' ? 'http://localhost:3000' : '';
      const res = await fetch(`${host}/api/menu/category`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.adminToken()}`
        },
        body: JSON.stringify({
          oldName: oldName,
          newName: this.newCategoryName.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        await this.fetchMenu();
        this.editingCategory.set(null);
        if (this.activeCat() === oldName) {
           this.activeCat.set(this.newCategoryName.trim());
        }
      }
    } catch (e) {
      console.error("Error al guardar categoría", e);
      this.showAlert("Hubo un error al guardar la categoría", "error");
    }
  }

  async applyInflation() {
    const pct = this.inflationPercentage();
    if (pct === 0) return;

    this.showConfirm(
      `¿Estás seguro de aumentar TODOS los precios un ${pct}%? Esta acción no se puede deshacer.`, 
      async () => {
        try {
          const host = window.location.hostname === 'localhost' && window.location.port === '4200' ? 'http://localhost:3000' : '';
          const res = await fetch(`${host}/api/menu/inflation`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.adminToken()}`
            },
            body: JSON.stringify({ percentage: pct })
          });
          const data = await res.json();
          if (data.success) {
            await this.fetchMenu();
            this.showInflationModal.set(false);
            this.showAlert(`Precios actualizados con éxito (+${pct}%)`, 'success');
          }
        } catch (e) {
          console.error(e);
          this.showAlert("Error al aplicar inflación", "error");
        }
      },
      'Ajuste de Precios',
      '📈'
    );
  }

  async onPdfUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    
    const file = input.files[0];
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      this.isUploading.set(true);
      const host = window.location.hostname === 'localhost' && window.location.port === '4200' ? 'http://localhost:3000' : '';
      const res = await fetch(`${host}/api/admin/upload-pdf`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.adminToken()}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        this.showAlert(data.message || "PDF subido correctamente", "success");
        this.showPdfModal.set(false);
        await this.fetchMenu();
      }
    } catch (e) {
      console.error(e);
      this.showAlert("Error al subir el PDF", "error");
    } finally {
      this.isUploading.set(false);
    }
  }

  // --- Biometric Authentication ---

  async registerBiometrics() {
    try {
      const host = window.location.hostname === 'localhost' && window.location.port === '4200' ? 'http://localhost:3000' : '';
      const optionsRes = await fetch(`${host}/api/auth/register-options`, {
        headers: { 'Authorization': `Bearer ${this.adminToken()}` }
      });
      const options = await optionsRes.json();
      if (options.error) {
        throw new Error(options.error);
      }

      const regResp = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch(`${host}/api/auth/verify-registration`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.adminToken()}`
        },
        body: JSON.stringify(regResp),
      });

      const verification = await verifyRes.json();
      if (verification.success) {
        this.hasBiometrics.set(true);
        localStorage.setItem('hasBiometrics', 'true');
        this.showAlert('¡Biometría registrada con éxito!', 'success');
      } else {
        this.showAlert('Error al verificar biometría', 'error');
      }
    } catch (e: any) {
      console.error(e);
      this.showAlert('Error: ' + e.message, 'error');
    }
  }

  async biometricLogin() {
    try {
      const host = window.location.hostname === 'localhost' && window.location.port === '4200' ? 'http://localhost:3000' : '';
      const optionsRes = await fetch(`${host}/api/auth/login-options`);
      const options = await optionsRes.json();
      if (options.error) {
        throw new Error(options.error);
      }

      const authResp = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch(`${host}/api/auth/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authResp),
      });

      const verification = await verifyRes.json();
      if (verification.success) {
        this.adminToken.set(verification.token);
        this.isAdmin.set(true);
        localStorage.setItem('adminToken', verification.token);
        localStorage.setItem('hasBiometrics', 'true');
        this.search.set('');
        this.showAlert('¡Acceso biométrico concedido!', 'success');
      } else {
        this.showAlert('Error de autenticación biométrica', 'error');
      }
    } catch (e: any) {
      console.error(e);
      this.showAlert('Error: ' + (e.message || 'Fallo desconocido'), 'error');
    }
  }
}
