
const MenuData = (() => {

    const API = "http://localhost:3000/api";

    // SOLICITUDES A LA API
    async function solicitar(ruta, opciones = {}) {
        try {
            const token = localStorage.getItem("token");

            const respuesta = await fetch(`${API}${ruta}`, {
                ...opciones,
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? {
                        Authorization: `Bearer ${token}`
                    } : {}),
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

        // INICIAR SESIÓN
        async iniciarSesion(usuario, contrasena) {
            const datos = await solicitar("/login", {
                method: "POST",
                body: JSON.stringify({
                    usuario,
                    contrasena
                })
            });

            localStorage.setItem("token", datos.token);
            localStorage.setItem(
                "usuario",
                JSON.stringify(datos.usuario)
            );

            return datos;
        },

        // CERRAR SESIÓN
        cerrarSesion() {
            localStorage.removeItem("token");
            localStorage.removeItem("usuario");
        },

        // CATEGORÍAS
        async categorias() {
            return await solicitar("/categorias");
        },

        async guardarCategoria({ id, nombre }) {
            return await solicitar(
                id ? `/categorias/${id}` : "/categorias",
                {
                    method: id ? "PUT" : "POST",
                    body: JSON.stringify({ nombre })
                }
            );
        },

        async eliminarCategoria(id) {
            return await solicitar(`/categorias/${id}`, {
                method: "DELETE"
            });
        },

        // PRODUCTOS
        async productos() {
            return await solicitar("/productos");
        },

        async guardarProducto(producto) {
            return await solicitar(
                producto.id
                    ? `/productos/${producto.id}`
                    : "/productos",
                {
                    method: producto.id ? "PUT" : "POST",
                    body: JSON.stringify(producto)
                }
            );
        },

        async bajaProducto(id) {
            return await solicitar(`/productos/${id}`, {
                method: "DELETE"
            });
        },

        async alternarDisponible(id) {
            return await solicitar(`/productos/${id}/disponibilidad`, {
                method: "PATCH"
            });
        }

    };

})();
