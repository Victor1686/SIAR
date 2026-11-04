// =====================================================================
// ARCHIVO: script.js
// FUNCION: Mostrar mensajes generales del sistema SIAR.
// =====================================================================

// Mostrar mensaje de confirmación
function mostrarMensaje() {
    alert("¡Gracias por tu pedido!");
}

// Mostrar mensaje personalizado
function mostrarAviso(mensaje) {
    alert(mensaje);
}

// Confirmar una acción
function confirmarAccion(mensaje) {
    return confirm(mensaje);
}