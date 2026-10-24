// =====================================================================
// ARCHIVO: menu-data.js
// PARA QUÉ SIRVE: guarda y maneja los datos del menú (productos y categorías).
// Las páginas admin-menu.html y menu.html usan este archivo.
// =====================================================================

const MenuData = (() => {

  // Nombre con el que se guarda la información dentro del navegador
  const KEY = "siar_menu";

  // ---------- DATOS INICIALES ----------
  // Lo que aparece la primera vez que se abre la página:
  // 4 categorías y 4 productos de ejemplo.
  const seed = {
    categorias: [
      { id: 1, nombre: "Entradas" }, { id: 2, nombre: "Platos fuertes" },
      { id: 3, nombre: "Bebidas" }, { id: 4, nombre: "Postres" }
    ],
    productos: [
      // activo: false significa "dado de baja" (borrado lógico, no se pierde el registro)
      // disponible: false significa "Agotado"
      { id: 1, nombre: "Hamburguesa especial", descripcion: "Carne, queso, verduras y papas.", precio: 25000, categoriaId: 2, imagen: "", activo: true, disponible: true },
      { id: 2, nombre: "Pizza ", descripcion: "Queso, jamón y pepperoni.", precio: 30000, categoriaId: 2, imagen: "", activo: true, disponible: true },
      { id: 3, nombre: "Pollo a la plancha", descripcion: "Con arroz, ensalada y papas.", precio: 28000, categoriaId: 2, imagen: "", activo: true, disponible: true },
      { id: 4, nombre: "Limonada", descripcion: "", precio: 8000, categoriaId: 3, imagen: "", activo: true, disponible: false }
    ]
  };

  // ---------- CARGAR DATOS ----------
  // Lee lo que hay guardado en el navegador.
  // Si no hay nada guardado todavía, usa los datos iniciales de arriba.
  function cargar() {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) return d; } catch (e) {}
    return JSON.parse(JSON.stringify(seed));
  }

  // ---------- GUARDAR DATOS ----------
  // Guarda los datos actuales en el navegador para que no se pierdan al recargar.
  function guardar() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

  // "db" son los datos actuales con los que trabaja el programa
  const db = cargar();

  // ---------- FUNCIONES AUXILIARES ----------
  // Calcula el siguiente número de ID (el mayor que existe + 1)
  const nuevoId = lista => lista.reduce((m, x) => Math.max(m, x.id), 0) + 1;
  // Devuelve un resultado de ERROR con un mensaje
  const err = error => ({ ok: false, error });
  // Guarda los cambios y devuelve un resultado EXITOSO
  const ok = () => { guardar(); return { ok: true }; };

  // ---------- FUNCIONES QUE USAN LAS PÁGINAS ----------
  return {

    // Devuelve la lista de todas las categorías
    categorias: () => db.categorias,

    // Devuelve solo los productos activos (los dados de baja no se muestran) - HU10
    productos: () => db.productos.filter(p => p.activo),

    // CREAR o EDITAR una categoría (botón "Guardar" de Categorías) - HU11
    guardarCategoria({ id, nombre }) {
      nombre = (nombre || "").trim();                                   // quita espacios sobrantes
      if (!nombre) return err("El nombre de la categoría es obligatorio."); // no puede estar vacío
      // no puede repetirse el nombre de otra categoría
      if (db.categorias.some(c => c.id !== id && c.nombre.toLowerCase() === nombre.toLowerCase()))
        return err("Ya existe una categoría con ese nombre.");
      if (id) db.categorias.find(c => c.id === id).nombre = nombre;     // si trae id: la edita
      else db.categorias.push({ id: nuevoId(db.categorias), nombre });  // si no: crea una nueva
      return ok();
    },

    // ELIMINAR una categoría (botón "Eliminar" de la lista de Categorías)
    eliminarCategoria(id) {
      // no se puede eliminar si todavía tiene productos
      if (db.productos.some(p => p.activo && p.categoriaId === id))
        return err("No se puede eliminar: tiene productos asociados.");
      db.categorias = db.categorias.filter(c => c.id !== id);
      return ok();
    },

    // CREAR o EDITAR un producto (botón "Guardar producto") - HU08 y HU09
    guardarProducto(p) {
      p.nombre = (p.nombre || "").trim();
      p.precio = Number(p.precio);
      // Validaciones: nombre obligatorio, precio positivo y categoría existente
      if (!p.nombre) return err("El nombre es obligatorio.");
      if (!(p.precio > 0)) return err("El precio debe ser un número positivo.");
      if (!db.categorias.some(c => c.id === p.categoriaId)) return err("Seleccione una categoría.");
      if (p.id) Object.assign(db.productos.find(x => x.id === p.id), p);  // si trae id: lo edita
      else db.productos.push({ ...p, id: nuevoId(db.productos), activo: true, disponible: true }); // si no: lo crea
      return ok();
    },

    // DAR DE BAJA un producto (botón "Eliminar" de la tabla de productos)
    // No lo borra de verdad: solo lo marca como inactivo (borrado lógico)
    // PENDIENTE: bloquear la baja si el producto está en un pedido activo (requiere módulo Pedidos).
    bajaProducto(id) { db.productos.find(p => p.id === id).activo = false; return ok(); },

    // CAMBIAR DISPONIBLE / AGOTADO (interruptor de la columna "Disponible") - HU12
    alternarDisponible(id) {
      const p = db.productos.find(x => x.id === id);
      p.disponible = !p.disponible;   // si estaba disponible pasa a agotado, y al revés
      return ok();
    }
  };
})();