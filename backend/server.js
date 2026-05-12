const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Servir la aplicación de Angular construida
app.use(express.static(path.join(__dirname, '../dist/molienda/browser')));

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    cat_type TEXT,
    name TEXT,
    price INTEGER,
    desc TEXT,
    tag TEXT
  )`);
});

const INITIAL_DATA = {
  "Promos Dulces": {
    type: "promos",
    items: [
      {name:"La Croisette", price:7000, desc:"Café o té · 2 tortitas raspadas, 2 croissants o porción budín/alfajor · Extra jugo +$500"},
      {name:"Bonjour", price:9000, desc:"Café o té · Jugo · 2 tortitas raspadas · Dip de manteca o queso crema · Mermeladas"},
      {name:"Louvre", price:9000, desc:"Café o té · Jugo · 2 tostadas pan de la casa · Queso crema o manteca · Mermelada casera"},
      {name:"Gâteau", price:13000, desc:"Café o té · Jugo · Mini cake a elección"},
      {name:"Oh Lala Paris", price:13000, desc:"Café o té · Jugo · 4 waffles · Crema chantilly · Frutos rojos · Nutella"},
      {name:"Versalles", price:13000, desc:"Café o té · Jugo · Bowl yogurt casero · Kiwi · Frutos rojos · Naranja · Granola · Frutos secos · Coco · Miel"},
      {name:"Montmartre", price:9500, desc:"Café o té · Jugo · Plato frutas de estación · Miel · Frutos secos · Coco"},
      {name:"La Madeleine", price:13000, desc:"Café o té · Jugo · Tostada francesa · Banana flambeada · Kiwi · Reducción frutos rojos"},
      {name:"Mon Amour", price:13000, desc:"Café o té · Jugo · 4 pancakes · Chantilly · Peras y manzanas salteadas · Nueces · Ganache"},
      {name:"Saint Tropez", price:14000, desc:"Café o té · Jugo · Producto sin TACC a elección", tag:"sin-tacc"},
      {name:"Lyon", price:14000, desc:"Café o té · Jugo · Carrot cake con glasé o tostada vegana salada", tag:"vegan"},
      {name:"Croissant à la Crème", price:13000, desc:"Café o té · Jugo · Flat croissant · Dulce de leche · Crema chantilly · Frutos rojos"},
    ]
  },
  "Promos Saladas": {
    type:"promos",
    items:[
      {name:"Notre Dame", price:12000, desc:"Café o té · Jugo · 2 medialunas con jamón natural y queso"},
      {name:"Croque Madame", price:12500, desc:"Café o té · Jugo · Sándwich pan de la casa · Bechamel · Jamón cocido · Queso gratinado · Huevo frito"},
      {name:"Je T'aime", price:14500, desc:"Café o té · Jugo · Bagel · Queso fontina · Queso crema con pimienta · Huevo frito · Palta · Lomito"},
      {name:"Croque Monsieur", price:13000, desc:"Café o té · Jugo · Tostado carlitero · Jamón y queso"},
      {name:"Philippe Le Bon", price:14000, desc:"Café o té · Jugo · Omelette grande · Jamón natural · Queso derretido · Tomates cherry"},
      {name:"Eiffel", price:14500, desc:"Café o té · Jugo · 2 tostadas · Queso crema · Palta · Huevos revueltos · Rollitos jamón y queso"},
      {name:"La Concorde", price:14500, desc:"Café o té · Jugo · Tostada · Queso gratinado · Palta · Huevo poché · Mix semillas"},
    ]
  },
  "Para Compartir": {
    type:"promos",
    items:[
      {name:"Pont des Arts", price:29000, desc:"Para 2 · 2 cafés/tés · 2 jugos · Tostadas · Queso crema · Palta · Huevos revueltos · Jamón · Mini cake · Medialuna j&q"},
      {name:"France", price:20000, desc:"Para 2 · Tetera · 2 jugos · 2 mini alfajorcitos · 2 croissants · 2 triángulos tostados jamón y queso"},
    ]
  },
  "Café": {
    type:"list",
    items:[
      {name:"Ristretto / Espresso", price:4000},
      {name:"Doppio", price:4500},
      {name:"Americano / Long Black", price:5000},
      {name:"Cortado", price:5000},
      {name:"Cappuccino / Moccaccino", price:5000},
      {name:"Flat White", price:5500},
      {name:"Latte / Latte Macchiato", price:5500},
      {name:"Chocolatada / Submarino", price:5000},
      {name:"Café Bombón", price:5000},
      {name:"Iced Latte / Frappuccino", price:6000},
      {name:"Caramel Latte / Vainilla Latte", price:6000},
      {name:"Milkshake Frutilla / Oreo", price:6000},
      {name:"Pistacho Latte", price:6500},
      {name:"Moccanutella", price:5500},
    ]
  },
  "Tés & Jugos": {
    type:"list",
    items:[
      {name:"Tetera individual", price:3400},
      {name:"Tetera para dos", price:4000},
      {name:"Jugo exprimido / Limonada", price:4500},
      {name:"Licuado frutos rojos / banana", price:4500},
      {name:"Jarra limonada 1.5L", price:9500},
    ]
  },
  "Panadería": {
    type:"list",
    items:[
      {name:"Croissant o tortita raspada", price:2000},
      {name:"Tortita jamón y queso", price:3500},
      {name:"Medialuna jamón y queso (1)", price:4500},
      {name:"Medialunas jamón y queso (2)", price:8000},
      {name:"Pan blanco molde", price:6500},
      {name:"Pan integral semillas", price:8500},
    ]
  },
  "Macarons": {
    type:"list",
    items:[
      {name:"Maracuyá · Coco · Limón", price:3500},
      {name:"Frutilla · Chocolate", price:3500},
      {name:"Frutos rojos · Pistacho", price:3500},
    ]
  },
  "Budines & Alfajores": {
    type:"list",
    items:[
      {name:"Budín naranja", price:3500},
      {name:"Budín vainilla chips y ganache", price:3500},
      {name:"Budín limón amapolas", price:3500},
      {name:"Budín banana chocolate nueces", price:3500},
      {name:"Budín coco chocolate blanco almendras", price:3500},
      {name:"Alfajor maicena / semi amargo", price:3700},
      {name:"Cookie red velvet", price:4500},
      {name:"Alfajor nuez", price:5000},
      {name:"Cookie pistacho y chips blancos", price:5000},
      {name:"Alfajor pistacho", price:5500},
    ]
  },
  "Mini Cakes": {
    type:"list",
    items:[
      {name:"Mini Coco / Rogel / Cabsha", price:7500},
      {name:"Mini Lemon Pie / Crumble Manzana", price:8000},
      {name:"Mini Key Lime Pie / Brownie Clásico", price:8000},
      {name:"Mini Brownie Franui / Frutos Rojos", price:8500},
      {name:"Mini Pavlova / Cheesecake", price:8500},
      {name:"Mini Cake Pistacho", price:9000},
      {name:"Mini Oreo Cake / Cake Kinder", price:8000},
    ]
  },
  "Tortas (Porción)": {
    type:"list",
    items:[
      {name:"Red Velvet / Matilda / Carrot Cake", price:9000},
      {name:"Marquise merengue y DDL", price:10200},
      {name:"Tartín Cabsha", price:10200},
      {name:"Lemon Pie", price:11000},
      {name:"Cheesecake", price:11400},
      {name:"Carrot Cake libre gluten keto", price:11000, tag:"sin-tacc"},
      {name:"Lingote Pistacho Low Carb", price:10100},
      {name:"Torta Matilda libre gluten keto", price:10100, tag:"sin-tacc"},
    ]
  },
  "Almuerzos": {
    type:"promos",
    items:[
      {name:"Menú Petit", price:13700, desc:"Apetizier · Bowl ensalada · Bebida sin alcohol"},
      {name:"Menú Pastas", price:16100, desc:"Apetizier · Sorrentinos (roquefort/nuez, calabaza/muzza, jamón/queso) · Bebida"},
      {name:"Menú Paris", price:19100, desc:"Apetizier · Tartín con ensalada · Postre o café · Bebida"},
      {name:"Moulin Rouge (ensalada)", price:10300, desc:"Arroz yamaní · Lentejas · Choclo · Cherry · Huevo duro · Palta · Zapallo"},
      {name:"Champi (ensalada)", price:10300, desc:"Cebolla caramelizada · Queso azul · Champiñones · Mozzarella"},
      {name:"Pastel Aligot (tartín)", price:10300, desc:"Carne mechada · Puré de papa · Queso aligot · Ensalada"},
      {name:"Pollo Crocante (ensalada)", price:10300, desc:"Cherry · Verdes · Choclo · Pollo apanado"},
    ]
  },
  "Bebidas & Alcohol": {
    type:"list",
    items:[
      {name:"Gaseosas / Agua / Agua saborizada", price:4000},
      {name:"Copa vino Críos (Malbec o Chard.)", price:5300},
      {name:"Corona Rubia 710cc", price:9500},
      {name:"Aperol Spritz", price:10400},
      {name:"Espumante Chandon", price:0, desc:"Consultar precio"},
    ]
  },
  "Tarde de Té": {
    type:"promos",
    items:[
      {name:"Tarde de Té", price:0, desc:"Con reserva previa · Café o té · Jugo · 3 petit four (cheesecake, cabsha, key lime pie) · Sándwich jamón/queso · Brioche de pollo · Mini bruschetta · Mini croissant · Consultar precio por WhatsApp"},
    ]
  },
};

db.get("SELECT COUNT(*) as count FROM items", (err, row) => {
  if (row && row.count === 0) {
    const stmt = db.prepare("INSERT INTO items (category, cat_type, name, price, desc, tag) VALUES (?, ?, ?, ?, ?, ?)");
    for (const cat of Object.keys(INITIAL_DATA)) {
      for (const item of INITIAL_DATA[cat].items) {
        stmt.run(cat, INITIAL_DATA[cat].type, item.name, item.price || 0, item.desc || null, item.tag || null);
      }
    }
    stmt.finalize();
    console.log("Database seeded successfully!");
  }
});

// Get the full menu
app.get('/api/menu', (req, res) => {
  db.all("SELECT * FROM items ORDER BY id ASC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const menu = {};
    rows.forEach(row => {
      if (!menu[row.category]) {
        menu[row.category] = { type: row.cat_type, items: [] };
      }
      menu[row.category].items.push({
        id: row.id,
        name: row.name,
        price: row.price,
        desc: row.desc,
        tag: row.tag
      });
    });
    res.json(menu);
  });
});

// Update an item
app.post('/api/menu/item/:id', (req, res) => {
  const { name, price, desc } = req.body;
  db.run(
    "UPDATE items SET name = ?, price = ?, desc = ? WHERE id = ?",
    [name, price, desc, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, changes: this.changes });
    }
  );
});

// Simple Login
app.post('/api/login', (req, res) => {
  if (req.body.password === 'molienda123') {
    res.json({ success: true, token: 'admin-token' });
  } else {
    res.status(401).json({ success: false });
  }
});

// Redirigir cualquier otra ruta no-API al index.html de Angular (para soportar recargas y routing)
app.get('*', (req, res) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, '../dist/molienda/browser/index.html'));
});

app.listen(3000, () => {
  console.log('Backend running on port 3000');
});
