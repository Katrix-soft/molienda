import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  }

  checkAdminUrl() {
    if (window.location.search.includes('admin=true')) {
      const savedToken = localStorage.getItem('adminToken');
      if (savedToken) {
        this.adminToken.set(savedToken);
        this.isAdmin.set(true);
      }
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
  }

  doSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.search.set(input.value);
  }

  fmtPrice(p: number, desc?: string): string {
    if (!p) return 'Consultar';
    return '$' + p.toLocaleString('es-AR');
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
      } else {
        alert("Contraseña incorrecta");
      }
    } catch (e) {
      console.error(e);
    }
  }

  startEdit(item: Item) {
    if (!this.isAdmin()) return;
    this.editingItem.set({ ...item });
  }

  cancelEdit() {
    this.editingItem.set(null);
  }

  async saveEdit() {
    const item = this.editingItem();
    if (!item) return;

    try {
      const host = window.location.hostname === 'localhost' && window.location.port === '4200' ? 'http://localhost:3000' : '';
      const res = await fetch(`${host}/api/menu/item/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      alert("Hubo un error al guardar");
    }
  }
}
