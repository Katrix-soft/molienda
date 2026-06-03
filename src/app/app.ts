import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KatrixBiometrics } from 'katrix-biometrics';

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
  readonly canUseBiometrics = signal<boolean>(typeof window !== 'undefined' && window.PublicKeyCredential !== undefined);
  hasBiometrics = signal<boolean>(false);

  private biometrics = new KatrixBiometrics({
    appName: 'Petit Patisserie',
    userId: 'admin-user',
    userName: 'admin@petitpatisserie.com',
  });

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
  showSettingsModal = signal<boolean>(false);
  hasPdf = signal<boolean>(false);
  isUploading = signal<boolean>(false);
  pdfStage = signal<'idle' | 'uploading' | 'analyzing' | 'saving' | 'done' | 'error'>('idle');
  pdfElapsed = signal<number>(0);
  pdfItemCount = signal<number>(0);
  pdfErrorMsg = signal<string>('');
  pdfQuote = signal<string>('');
  private pdfTimerRef: ReturnType<typeof setInterval> | null = null;
  private pdfQuoteRef: ReturnType<typeof setInterval> | null = null;
  private pdfQuoteIdx = 0;
  private pdfQuoteShuffled: string[] = [];

  private readonly PDF_QUOTES = [
    'Todo lo podés cuando tenés fe en lo que hacés.',
    'Lo que encomendás con el corazón, el tiempo lo cumple.',
    'No te desanimes. Lo que ves crecer despacio, crece para siempre.',
    'El que cuida los detalles pequeños, construye cosas grandes.',
    'Seguí llamando. Las puertas que importan siempre se abren.',
    'El trabajo sin amor no alimenta el alma. El tuyo sí.',
    'Hay un momento para todo. Este es el tuyo.',
    'Hacé el bien hoy. Mañana ya va a hablar por vos.',
    'Fuiste amado antes de empezar. Eso no cambia.',
    'El que trabaja con alegría, cosecha más de lo que siembra.',
    'No te canses. Lo que estás construyendo vale cada segundo.',
    'Seré contigo en cada paso que des con valentía.',
  ];

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
    // 1. Try to load from cache (localStorage) first for instant render
    let hasCache = false;
    try {
      const cached = localStorage.getItem('menu_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Object.keys(parsed).length > 0) {
          this.menuData.set(parsed);
          this.activeCat.set(Object.keys(parsed)[0]);
          this.loading.set(false); // Skip spinner
          hasCache = true;
        }
      }
    } catch (e) {
      console.error("Error reading menu cache", e);
    }

    // 2. If we don't have cache, show loading spinner
    if (!hasCache) {
      this.loading.set(true);
    }

    // 3. Fetch fresh data in the background
    try {
      const host = window.location.hostname === 'localhost' && window.location.port === '4200' 
        ? 'http://localhost:3000' 
        : '';
      const res = await fetch(`${host}/api/menu`);
      const data = await res.json();
      
      // Update UI with fresh data
      this.menuData.set(data);
      
      // Keep active category if still valid, otherwise select first
      const currentCat = this.activeCat();
      if (!currentCat || !data[currentCat]) {
        if (Object.keys(data).length > 0) {
          this.activeCat.set(Object.keys(data)[0]);
        }
      }

      // Update localStorage cache
      localStorage.setItem('menu_cache', JSON.stringify(data));
    } catch (e) {
      console.error("Error fetching menu", e);
      if (!hasCache) {
        this.showAlert("Error al cargar la información", "error");
      }
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
    let val = input.value;

    // Security: once 'belen' is typed, lock the input
    if (this.search() === 'belen' && val.toLowerCase().startsWith('belen') && val.length > 5) {
      input.value = 'belen';
      return;
    }

    // Detect the secret word and lock immediately
    if (val.trim().toLowerCase() === 'belen') {
      this.search.set('belen');
      input.value = 'belen';
      input.blur(); // Remove focus to prevent further typing

      if (this.canUseBiometrics() && this.hasBiometrics()) {
        setTimeout(() => {
          this.biometricLogin();
        }, 300);
      }
      return;
    }

    this.search.set(val);
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
    try {
      const status = this.biometrics.getStatus();
      this.hasBiometrics.set(status.linked);
    } catch (e) {
      console.error("Error checking biometrics", e);
    }
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

  async resetDb() {
    this.showConfirm(
      'Esto borrará TODOS los datos actuales del menú y los reemplazará con el menú original. ¿Estás segura?',
      async () => {
        try {
          const host = window.location.hostname === 'localhost' && window.location.port === '4200' ? 'http://localhost:3000' : '';
          const res = await fetch(`${host}/api/admin/reset-db`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.adminToken()}` }
          });
          const data = await res.json();
          if (data.success) {
            localStorage.removeItem('menu_cache');
            await this.fetchMenu();
            this.showAlert('✅ Base de datos reseteada al menú original', 'success');
          } else {
            this.showAlert(data.error || 'Error al resetear', 'error');
          }
        } catch (e) {
          this.showAlert('Error de conexión al resetear', 'error');
        }
      },
      'Resetear Base de Datos',
      '🗑️'
    );
  }

  private startPdfTimer() {
    this.pdfElapsed.set(0);
    this.pdfTimerRef = setInterval(() => this.pdfElapsed.update(v => v + 1), 1000);
  }

  private stopPdfTimer() {
    if (this.pdfTimerRef) { clearInterval(this.pdfTimerRef); this.pdfTimerRef = null; }
    if (this.pdfQuoteRef) { clearInterval(this.pdfQuoteRef); this.pdfQuoteRef = null; }
  }

  private startPdfQuotes() {
    this.pdfQuoteShuffled = [...this.PDF_QUOTES].sort(() => Math.random() - 0.5);
    this.pdfQuoteIdx = 0;
    this.pdfQuote.set(this.pdfQuoteShuffled[0]);
    // Avanza sola cada 30 segundos
    this.pdfQuoteRef = setInterval(() => this.nextPdfQuote(), 30000);
  }

  nextPdfQuote() {
    if (!this.pdfQuoteShuffled.length) return;
    this.pdfQuoteIdx = (this.pdfQuoteIdx + 1) % this.pdfQuoteShuffled.length;
    this.pdfQuote.set(this.pdfQuoteShuffled[this.pdfQuoteIdx]);
    // Reinicia el timer para que la nueva frase dure otros 30s
    if (this.pdfQuoteRef) { clearInterval(this.pdfQuoteRef); }
    this.pdfQuoteRef = setInterval(() => this.nextPdfQuote(), 30000);
  }

  closePdfModal() {
    this.showPdfModal.set(false);
    this.pdfStage.set('idle');
    this.pdfElapsed.set(0);
    this.pdfItemCount.set(0);
    this.pdfErrorMsg.set('');
    this.pdfQuote.set('');
    this.stopPdfTimer();
  }

  async onPdfUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    
    const file = input.files[0];
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      this.isUploading.set(true);
      this.pdfStage.set('uploading');
      this.startPdfQuotes();
      this.startPdfTimer();

      // Give UI a tick to show "uploading" phase
      await new Promise(r => setTimeout(r, 500));
      this.pdfStage.set('analyzing');

      const host = window.location.hostname === 'localhost' && window.location.port === '4200' ? 'http://localhost:3000' : '';
      const res = await fetch(`${host}/api/admin/upload-pdf`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.adminToken()}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        this.pdfStage.set('saving');
        await new Promise(r => setTimeout(r, 600));
        this.pdfItemCount.set(data.count ?? 0);
        this.pdfStage.set('done');
        this.stopPdfTimer();
        await this.fetchMenu();
      } else {
        console.error("Backend error:", data);
        this.pdfErrorMsg.set(data.error || "Ocurrió un error al procesar el PDF");
        this.pdfStage.set('error');
        this.stopPdfTimer();
      }
    } catch (e) {
      console.error(e);
      this.pdfErrorMsg.set("Error de red al subir el PDF");
      this.pdfStage.set('error');
      this.stopPdfTimer();
    } finally {
      this.isUploading.set(false);
    }
  }

  // --- Biometric Authentication ---

  async registerBiometrics() {
    if (this.hasBiometrics()) {
      this.showConfirm(
        '¿Querés desvincular el acceso biométrico de este dispositivo?',
        () => {
          this.biometrics.unlink();
          localStorage.removeItem('katrix_bio_token');
          this.hasBiometrics.set(false);
          this.showAlert('Biometría desvinculada del dispositivo', 'info');
        },
        'Desvincular Biometría',
        '🔓'
      );
      return;
    }

    try {
      const result = await this.biometrics.register();
      if (result.success) {
        this.hasBiometrics.set(true);
        const token = this.adminToken();
        if (token) {
          localStorage.setItem('katrix_bio_token', token);
        }
        this.showAlert('¡Biometría registrada con éxito!', 'success');
      } else {
        this.showAlert('Error al registrar biometría: ' + result.error.message, 'error');
      }
    } catch (e: any) {
      console.error(e);
      this.showAlert('Error: ' + e.message, 'error');
    }
  }

  async biometricLogin() {
    try {
      const result = await this.biometrics.authenticate();
      if (result.success) {
        const token = localStorage.getItem('katrix_bio_token');
        if (token) {
          this.adminToken.set(token);
          this.isAdmin.set(true);
          localStorage.setItem('adminToken', token);
          this.search.set('');
          this.showAlert('¡Acceso biométrico concedido!', 'success');
        } else {
          this.showAlert('No se encontró un token guardado. Iniciá sesión con contraseña primero.', 'error');
        }
      } else {
        this.showAlert('Error de autenticación biométrica: ' + result.error.message, 'error');
      }
    } catch (e: any) {
      console.error(e);
      this.showAlert('Error: ' + (e.message || 'Fallo desconocido'), 'error');
    }
  }
}
