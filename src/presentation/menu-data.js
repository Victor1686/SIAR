// =====================================================================
// ARCHIVO: menu-data.js
// FUNCION: Conectar las páginas del menú con la API de SIAR.
// Los datos se consultan y guardan en MySQL.
// =====================================================================

const MenuData = (() => {

    const API = "http://localhost:3000/api";

    // Realizar solicitudes a la API
    async function solicitar(ruta, opciones = {}) {
        try {
            const respuesta = await fetch(`${API}${ruta}`, {
                ...opciones,
                headers: {
                    "Content-Type": "application/json",
                    ...(opciones.headers || {})
                }
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(datos.error || "Error en la solicitud");
            }

            return datos;

        } catch (error) {
            throw new Error(
                error.message.includes("Failed to fetch")
                    ? "No se pudo conectar con el servidor SIAR."
                    : error.message
            );
        }
    }

    return {

        // Consultar categorías
        async categorias() {
            return await solicitar("/categorias");
        },

        // Consultar productos
        async productos() {
            return await solicitar("/productos");
        },

        // Crear o editar categoría
        async guardarCategoria({ id, nombre }) {
            nombre = String(nombre || "").trim();

            if (!nombre) {
                throw new Error("El nombre de la categoría es obligatorio.");
            }

            if (id) {
                return await solicitar(`/categorias/${id}`, {
                    method: "PUT",
                    body: JSON.stringify({ nombre })
                });
            }

            return await solicitar("/categorias", {
                method: "POST",
                body: JSON.stringify({ nombre })
            });
        },

        // Dar de baja categoría
        async eliminarCategoria(id) {
            return await solicitar(`/categorias/${id}`, {
                method: "DELETE"
            });
        },

        // Crear o editar producto
        async guardarProducto(producto) {
            const datos = {
                nombre: String(producto.nombre || "").trim(),
                descripcion: producto.descripcion || "",
                precio: Number(producto.precio),
                categoriaId: Number(producto.categoriaId),
                imagen: producto.imagen || ""
            };

            if (!datos.nombre) {
                throw new Error("El nombre del producto es obligatorio.");
            }

            if (!Number.isFinite(datos.precio) || datos.precio <= 0) {
                throw new Error("El precio debe ser un número positivo.");
            }

            if (!Number.isInteger(datos.categoriaId) || datos.categoriaId <= 0) {
                throw new Error("Seleccione una categoría.");
            }

            if (producto.id) {
                return await solicitar(`/productos/${producto.id}`, {
                    method: "PUT",
                    body: JSON.stringify(datos)
                });
            }

            return await solicitar("/productos", {
                method: "POST",
                body: JSON.stringify(datos)
            });
        },

        // Dar de baja producto
        async bajaProducto(id) {
            return await solicitar(`/productos/${id}`, {
                method: "DELETE"
            });
        },

        // Cambiar disponibilidad
        async alternarDisponible(id) {
            return await solicitar(`/productos/${id}/disponibilidad`, {
                method: "PATCH"
            });
        }
    };

})();