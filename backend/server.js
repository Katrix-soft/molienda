const express = require('express');
const { execSync } = require('child_process');
const cors = require('cors');
const compression = require('compression');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const pdfModule = require('pdf-parse');
const pdf = pdfModule.PDFParse || pdfModule;
// katrix-biometrics handles WebAuthn entirely client-side — no server-side lib needed

const JWT_SECRET = process.env.JWT_SECRET || 'petit-patisserie-super-secret-key-2026';
// Hash for password 'molienda123'
const ADMIN_HASH = bcrypt.hashSync('molienda123', 10);

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Unauthorized' });
    next();
  });
};

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false })); // CSP off para no romper Angular
app.use(cors());
app.use(express.json());
app.use(compression()); // Comprimir respuestas para mejorar velocidad

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Servir la aplicación de Angular construida con cache
app.use(express.static(path.join(__dirname, '../dist/molienda/browser'), {
  maxAge: '1d',
  etag: true
}));
app.use('/public', express.static(path.join(__dirname, 'public'), {
  maxAge: '1d'
}));

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));

let cachedMenu = null;
const clearCache = () => { cachedMenu = null; };

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

const fs = require('fs');
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}
app.use('/public', express.static(publicDir));

// Multer config for PDF
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, publicDir),
  filename: (req, file, cb) => cb(null, 'menu_completo.pdf')
});
const upload = multer({ storage });

const INITIAL_DATA = {
  "Promos Dulces": {
    type: "promos",
    items: [
      { name: "La Croisette", price: 7000, desc: "Café o té · 2 tortitas raspadas, 2 croissants o porción budín/alfajor · Extra jugo +$500" },
      { name: "Bonjour", price: 9000, desc: "Café o té · Jugo · 2 tortitas raspadas · Dip de manteca o queso crema · Mermeladas" },
      { name: "Louvre", price: 9000, desc: "Café o té · Jugo · 2 tostadas pan de la casa · Queso crema o manteca · Mermelada casera" },
      { name: "Gâteau", price: 13000, desc: "Café o té · Jugo · Mini cake a elección" },
      { name: "Oh Lala Paris", price: 13000, desc: "Café o té · Jugo · 4 waffles · Crema chantilly · Frutos rojos · Nutella" },
      { name: "Versalles", price: 13000, desc: "Café o té · Jugo · Bowl yogurt casero · Kiwi · Frutos rojos · Naranja · Granola · Frutos secos · Coco · Miel" },
      { name: "Montmartre", price: 9500, desc: "Café o té · Jugo · Plato frutas de estación · Miel · Frutos secos · Coco" },
      { name: "La Madeleine", price: 13000, desc: "Café o té · Jugo · Tostada francesa · Banana flambeada · Kiwi · Reducción frutos rojos" },
      { name: "Mon Amour", price: 13000, desc: "Café o té · Jugo · 4 pancakes · Chantilly · Peras y manzanas salteadas · Nueces · Ganache" },
      { name: "Saint Tropez", price: 14000, desc: "Café o té · Jugo · Producto sin TACC a elección", tag: "sin-tacc" },
      { name: "Lyon", price: 14000, desc: "Café o té · Jugo · Carrot cake con glasé o tostada vegana salada", tag: "vegan" },
      { name: "Croissant à la Crème", price: 13000, desc: "Café o té · Jugo · Flat croissant · Dulce de leche · Crema chantilly · Frutos rojos" },
    ]
  },
  "Promos Saladas": {
    type: "promos",
    items: [
      { name: "Notre Dame", price: 12000, desc: "Café o té · Jugo · 2 medialunas con jamón natural y queso" },
      { name: "Croque Madame", price: 12500, desc: "Café o té · Jugo · Sándwich pan de la casa · Bechamel · Jamón cocido · Queso gratinado · Huevo frito" },
      { name: "Je T'aime", price: 14500, desc: "Café o té · Jugo · Bagel · Queso fontina · Queso crema con pimienta · Huevo frito · Palta · Lomito" },
      { name: "Croque Monsieur", price: 13000, desc: "Café o té · Jugo · Tostado carlitero · Jamón y queso" },
      { name: "Philippe Le Bon", price: 14000, desc: "Café o té · Jugo · Omelette grande · Jamón natural · Queso derretido · Tomates cherry" },
      { name: "Eiffel", price: 14500, desc: "Café o té · Jugo · 2 tostadas · Queso crema · Palta · Huevos revueltos · Rollitos jamón y queso" },
      { name: "La Concorde", price: 14500, desc: "Café o té · Jugo · Tostada · Queso gratinado · Palta · Huevo poché · Mix semillas" },
    ]
  },
  "Para Compartir": {
    type: "promos",
    items: [
      { name: "Pont des Arts", price: 29000, desc: "Para 2 · 2 cafés/tés · 2 jugos · Tostadas · Queso crema · Palta · Huevos revueltos · Jamón · Mini cake · Medialuna j&q" },
      { name: "France", price: 20000, desc: "Para 2 · Tetera · 2 jugos · 2 mini alfajorcitos · 2 croissants · 2 triángulos tostados jamón y queso" },
    ]
  },
  "Café": {
    type: "list",
    items: [
      { name: "Ristretto / Espresso", price: 4000 },
      { name: "Doppio", price: 4500 },
      { name: "Americano / Long Black", price: 5000 },
      { name: "Cortado", price: 5000 },
      { name: "Cappuccino / Moccaccino", price: 5000 },
      { name: "Flat White", price: 5500 },
      { name: "Latte / Latte Macchiato", price: 5500 },
      { name: "Chocolatada / Submarino", price: 5000 },
      { name: "Café Bombón", price: 5000 },
      { name: "Iced Latte / Frappuccino", price: 6000 },
      { name: "Caramel Latte / Vainilla Latte", price: 6000 },
      { name: "Milkshake Frutilla / Oreo", price: 6000 },
      { name: "Pistacho Latte", price: 6500 },
      { name: "Moccanutella", price: 5500 },
    ]
  },
  "Tés & Jugos": {
    type: "list",
    items: [
      { name: "Tetera individual", price: 3400 },
      { name: "Tetera para dos", price: 4000 },
      { name: "Jugo exprimido / Limonada", price: 4500 },
      { name: "Licuado frutos rojos / banana", price: 4500 },
      { name: "Jarra limonada 1.5L", price: 9500 },
    ]
  },
  "Panadería": {
    type: "list",
    items: [
      { name: "Croissant o tortita raspada", price: 2000 },
      { name: "Tortita jamón y queso", price: 3500 },
      { name: "Medialuna jamón y queso (1)", price: 4500 },
      { name: "Medialunas jamón y queso (2)", price: 8000 },
      { name: "Pan blanco molde", price: 6500 },
      { name: "Pan integral semillas", price: 8500 },
    ]
  },
  "Macarons": {
    type: "list",
    items: [
      { name: "Maracuyá · Coco · Limón", price: 3500 },
      { name: "Frutilla · Chocolate", price: 3500 },
      { name: "Frutos rojos · Pistacho", price: 3500 },
    ]
  },
  "Budines & Alfajores": {
    type: "list",
    items: [
      { name: "Budín naranja", price: 3500 },
      { name: "Budín vainilla chips y ganache", price: 3500 },
      { name: "Budín limón amapolas", price: 3500 },
      { name: "Budín banana chocolate nueces", price: 3500 },
      { name: "Budín coco chocolate blanco almendras", price: 3500 },
      { name: "Alfajor maicena / semi amargo", price: 3700 },
      { name: "Cookie red velvet", price: 4500 },
      { name: "Alfajor nuez", price: 5000 },
      { name: "Cookie pistacho y chips blancos", price: 5000 },
      { name: "Alfajor pistacho", price: 5500 },
    ]
  },
  "Mini Cakes": {
    type: "list",
    items: [
      { name: "Mini Coco / Rogel / Cabsha", price: 7500 },
      { name: "Mini Lemon Pie / Crumble Manzana", price: 8000 },
      { name: "Mini Key Lime Pie / Brownie Clásico", price: 8000 },
      { name: "Mini Brownie Franui / Frutos Rojos", price: 8500 },
      { name: "Mini Pavlova / Cheesecake", price: 8500 },
      { name: "Mini Cake Pistacho", price: 9000 },
      { name: "Mini Oreo Cake / Cake Kinder", price: 8000 },
    ]
  },
  "Tortas (Porción)": {
    type: "list",
    items: [
      { name: "Red Velvet / Matilda / Carrot Cake", price: 9000 },
      { name: "Marquise merengue y DDL", price: 10200 },
      { name: "Tartín Cabsha", price: 10200 },
      { name: "Lemon Pie", price: 11000 },
      { name: "Cheesecake", price: 11400 },
      { name: "Carrot Cake libre gluten keto", price: 11000, tag: "sin-tacc" },
      { name: "Lingote Pistacho Low Carb", price: 10100 },
      { name: "Torta Matilda libre gluten keto", price: 10100, tag: "sin-tacc" },
    ]
  },
  "Almuerzos": {
    type: "promos",
    items: [
      { name: "Menú Petit", price: 13700, desc: "Apetizier · Bowl ensalada · Bebida sin alcohol" },
      { name: "Menú Pastas", price: 16100, desc: "Apetizier · Sorrentinos (roquefort/nuez, calabaza/muzza, jamón/queso) · Bebida" },
      { name: "Menú Paris", price: 19100, desc: "Apetizier · Tartín con ensalada · Postre o café · Bebida" },
      { name: "Moulin Rouge (ensalada)", price: 10300, desc: "Arroz yamaní · Lentejas · Choclo · Cherry · Huevo duro · Palta · Zapallo" },
      { name: "Champi (ensalada)", price: 10300, desc: "Cebolla caramelizada · Queso azul · Champiñones · Mozzarella" },
      { name: "Pastel Aligot (tartín)", price: 10300, desc: "Carne mechada · Puré de papa · Queso aligot · Ensalada" },
      { name: "Pollo Crocante (ensalada)", price: 10300, desc: "Cherry · Verdes · Choclo · Pollo apanado" },
    ]
  },
  "Bebidas & Alcohol": {
    type: "list",
    items: [
      { name: "Gaseosas / Agua / Agua saborizada", price: 4000 },
      { name: "Copa vino Críos (Malbec o Chard.)", price: 5300 },
      { name: "Corona Rubia 710cc", price: 9500 },
      { name: "Aperol Spritz", price: 10400 },
      { name: "Espumante Chandon", price: 0, desc: "Consultar precio" },
    ]
  },
  "Tarde de Té": {
    type: "promos",
    items: [
      { name: "Tarde de Té", price: 0, desc: "Con reserva previa · Café o té · Jugo · 3 petit four (cheesecake, cabsha, key lime pie) · Sándwich jamón/queso · Brioche de pollo · Mini bruschetta · Mini croissant · Consultar precio por WhatsApp" },
    ]
  },
};

db.get("SELECT count(*) as count FROM items", (err, row) => {
  if (row && row.count === 0 && !process.env.SKIP_SEED) {
    console.log("Seeding initial data...");
    const stmt = db.prepare("INSERT INTO items (category, cat_type, name, price, desc, tag) VALUES (?, ?, ?, ?, ?, ?)");
    for (const cat of Object.keys(INITIAL_DATA)) {
      for (const item of INITIAL_DATA[cat].items) {
        stmt.run(cat, INITIAL_DATA[cat].type, item.name, item.price || 0, item.desc || null, item.tag || null);
      }
    }
    stmt.finalize();
  }
});

// Get the full menu
app.get('/api/menu', (req, res) => {
  if (cachedMenu) {
    return res.json(cachedMenu);
  }
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
    cachedMenu = menu;
    res.json(menu);
  });
});

app.get('/api/menu-pdf-check', (req, res) => {
  const filePath = path.join(publicDir, 'menu_completo.pdf');
  res.json({ exists: fs.existsSync(filePath) });
});

// Update an item (Protected)
app.post('/api/menu/item/:id', verifyToken, (req, res) => {
  const { name, price, desc, tag } = req.body;
  db.run('UPDATE items SET name = ?, price = ?, desc = ?, tag = ? WHERE id = ?', [name, price, desc, tag, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    clearCache();
    res.json({ success: true });
  });
});

// Actualizar todos los precios (Inflación)
app.post('/api/menu/inflation', verifyToken, (req, res) => {
  const { percentage } = req.body;
  if (percentage === undefined || isNaN(percentage)) return res.status(400).json({ error: 'Invalid percentage' });

  const multiplier = 1 + (percentage / 100);
  db.run('UPDATE items SET price = CAST(price * ? AS INTEGER)', [multiplier], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    clearCache();
    res.json({ success: true });
  });
});

function hasPdftoppm() {
  try {
    execSync('pdftoppm -v', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

// Cargar Menú PDF y procesar inteligentemente mediante LLM Visual o de Texto
app.post('/api/admin/upload-pdf', verifyToken, upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const pdfPath = req.file.path;
    let allItems = [];
    let processedPages = 0;

    if (hasPdftoppm()) {
      // --- OPCION A: Producción (VPS) usando imágenes con llava ---
      const imgDir = path.join(publicDir, 'pdf_pages');
      if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir);

      execSync(`pdftoppm -jpeg -r 150 "${pdfPath}" "${imgDir}/page"`);

      const pages = fs.readdirSync(imgDir)
        .filter(f => f.endsWith('.jpg'))
        .sort();

      for (const page of pages) {
        const imgPath = path.join(imgDir, page);
        const imgBase64 = fs.readFileSync(imgPath).toString('base64');
        const promptText = `Analizá esta imagen de un menú de café/pastelería. Extraé TODOS los productos con sus precios.
Devolvé SOLO un JSON array válido, sin texto adicional.
Formato: [{"category":"nombre categoría","cat_type":"list o promos","name":"nombre","price":0000,"desc":"descripción o null","tag":"sin-tacc o vegan o null"}]
- cat_type "promos" si incluye bebida+comida juntos, sino "list"
- price como número entero sin $ ni puntos
- tag: "sin-tacc", "vegan", o null
SOLO EL JSON:`;

        const ollamaRes = await fetch('https://apikat.katrix.com.ar/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llava:7b',
            stream: false,
            prompt: promptText,
            images: [imgBase64]
          })
        });

        const data = await ollamaRes.json();

        try {
          let jsonStr = data.response.trim().replace(/```json|```/g, '').trim();
          const start = jsonStr.indexOf('[');
          const end = jsonStr.lastIndexOf(']');
          if (start !== -1 && end !== -1) {
            const items = JSON.parse(jsonStr.substring(start, end + 1));
            allItems = allItems.concat(items);
          }
        } catch (e) {
          console.log(`Page ${page} parse failed:`, e.message);
        }
      }

      processedPages = pages.length;
      pages.forEach(p => fs.unlinkSync(path.join(imgDir, p)));

    } else {
      // --- OPCION B: Desarrollo Local (Windows) usando texto con qwen ---
      const dataBuffer = fs.readFileSync(pdfPath);
      const pdfData = await pdf(dataBuffer);
      let pdfText = pdfData.text;

      // Truncar el texto para ignorar basura y frases finales
      const stopIndex = pdfText.toUpperCase().indexOf('GRACIAS POR SER PARTE');
      if (stopIndex !== -1) {
        pdfText = pdfText.substring(0, stopIndex);
      }

      let token = process.env.OPENWEBUI_TOKEN;
      if (!token) {
        try {
          const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
          const match = envFile.match(/OPENWEBUI_TOKEN=(.*)/);
          if (match) token = match[1].trim();
        } catch(e) {}
      }

      const promptText = `Analizá el siguiente texto extraído de un menú de café/pastelería. Extraé TODOS los productos con sus precios.
Texto del menú:
${pdfText}

Devolvé SOLO un JSON array válido, sin texto adicional ni bloques markdown, que empiece con [ y termine con ].
Formato: [{"category":"nombre categoría","cat_type":"list o promos","name":"nombre","price":0000,"desc":"descripción o null","tag":"sin-tacc o vegan o null"}]
- cat_type "promos" si incluye bebida+comida juntos, sino "list"
- price como número entero sin $ ni puntos
- tag: "sin-tacc", "vegan", o null
SOLO EL JSON:`;

      const response = await fetch('https://vps-katrix-openwebui.juidi9.easypanel.host/api/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'qwen2.5:1.5b',
          messages: [{ role: 'user', content: promptText }]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`OpenWebUI API Error: ${data.error?.message || response.statusText}`);
      }

      try {
        let jsonStr = data.choices[0].message.content.trim().replace(/```json|```/g, '').trim();
        const start = jsonStr.indexOf('[');
        const end = jsonStr.lastIndexOf(']');
        if (start !== -1 && end !== -1) {
          const items = JSON.parse(jsonStr.substring(start, end + 1));
          allItems = allItems.concat(items);
        }
      } catch (e) {
        throw new Error('El modelo no devolvió un JSON válido. Reintentá.');
      }
      processedPages = 1;
    }

    if (allItems.length === 0) {
      return res.status(400).json({ error: 'No se pudieron extraer productos.' });
    }

    // 4. Guardar en DB
    db.serialize(() => {
      db.run('DELETE FROM items');
      const stmt = db.prepare(
        'INSERT INTO items (category, cat_type, name, price, desc, tag) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const item of allItems) {
        stmt.run(
          item.category || 'General',
          item.cat_type || 'list',
          item.name,
          item.price || 0,
          item.desc || null,
          item.tag || null
        );
      }
      stmt.finalize();
      clearCache();
    });

    res.json({
      success: true,
      count: allItems.length,
      message: `Se importaron ${allItems.length} productos desde ${processedPages} páginas.`
    });

  } catch (err) {
    console.error('PDF Process Error:', err);
    res.status(500).json({ error: 'Error: ' + err.message });
  }
});

// Reset DB to initial data (Protected)
app.post('/api/admin/reset-db', verifyToken, (req, res) => {
  db.serialize(() => {
    db.run('DELETE FROM items', (err) => {
      if (err) return res.status(500).json({ error: err.message });

      const stmt = db.prepare('INSERT INTO items (category, cat_type, name, price, desc, tag) VALUES (?, ?, ?, ?, ?, ?)');
      for (const cat of Object.keys(INITIAL_DATA)) {
        for (const item of INITIAL_DATA[cat].items) {
          stmt.run(cat, INITIAL_DATA[cat].type, item.name, item.price || 0, item.desc || null, item.tag || null);
        }
      }
      stmt.finalize((err) => {
        if (err) return res.status(500).json({ error: err.message });
        clearCache();
        res.json({ success: true, message: 'Base de datos reseteada al menú original.' });
      });
    });
  });
});

// Update a category (Protected)
app.post('/api/menu/category', verifyToken, (req, res) => {
  const { oldName, newName } = req.body;
  if (!oldName || !newName) return res.status(400).json({ error: 'Missing names' });
  db.run(
    "UPDATE items SET category = ? WHERE category = ?",
    [newName, oldName],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      clearCache();
      res.json({ success: true, changes: this.changes });
    }
  );
});

// Secure Login
app.post('/api/login', (req, res) => {
  const password = req.body.password || '';
  if (bcrypt.compareSync(password, ADMIN_HASH)) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

// Biometric auth is handled entirely client-side by katrix-biometrics
// No server-side WebAuthn endpoints needed

// Manejo de rutas no encontradas (404)
app.use((req, res) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  }
  res.sendFile(path.join(__dirname, '../dist/molienda/browser/index.html'));
});

// Manejador de errores global para evitar respuestas HTML en errores 500
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

app.listen(3000, () => {
  console.log('Backend running on port 3000');
});
