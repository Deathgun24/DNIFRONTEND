document.addEventListener('DOMContentLoaded', function() {
    const descargarFormatoBtn = document.getElementById('descargarFormato');
    const archivoDnisInput = document.getElementById('archivoDnis');
    const procesarBtn = document.getElementById('procesar');
    const mensajesDiv = document.getElementById('mensajes');
    const progresoDiv = document.getElementById('progreso');
    const barraProgreso = document.querySelector('.progreso-llenado');
    const textoProgreso = document.querySelector('.texto-progreso');

    // Descargar formato
    descargarFormatoBtn.addEventListener('click', function() {
        window.location.href = '/descargar-formato';
    });

    // Habilitar botón de procesar cuando se seleccione un archivo
    archivoDnisInput.addEventListener('change', function() {
        procesarBtn.disabled = !this.files.length;
        if (this.files.length) {
            mostrarMensaje(`Archivo seleccionado: ${this.files[0].name}`, 'info');
        }
    });

    // Procesar archivo
    procesarBtn.addEventListener('click', async function() {
        if (!archivoDnisInput.files.length) {
            mostrarMensaje('Por favor, selecciona un archivo primero', 'error');
            return;
        }

        const file = archivoDnisInput.files[0];
        
        // Validar tipo de archivo
        if (!file.name.match(/\.(csv|txt)$/i)) {
            mostrarMensaje('Por favor, selecciona un archivo CSV o TXT', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        // Mostrar progreso
        mostrarProgreso(true);
        mostrarMensaje('Procesando DNIs, por favor espera... Esto puede tomar varios minutos dependiendo de la cantidad de DNIs.', 'info');

        // Deshabilitar botones durante el procesamiento
        descargarFormatoBtn.disabled = true;
        procesarBtn.disabled = true;
        archivoDnisInput.disabled = true;

        try {
            const response = await fetch('/procesar-dnis', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error en el servidor');
            }

            const blob = await response.blob();
            
            // Crear enlace para descargar el archivo
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'resultados_dnis.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            
            mostrarMensaje('✅ Procesamiento completado. El archivo "resultados_dnis.csv" se está descargando.', 'exito');
            
        } catch (error) {
            console.error('Error:', error);
            mostrarMensaje('❌ Error al procesar el archivo: ' + error.message, 'error');
        } finally {
            // Rehabilitar elementos
            descargarFormatoBtn.disabled = false;
            procesarBtn.disabled = false;
            archivoDnisInput.disabled = false;
            mostrarProgreso(false);
        }
    });

    function mostrarMensaje(texto, tipo) {
        const mensaje = document.createElement('div');
        mensaje.className = `mensaje ${tipo}`;
        mensaje.textContent = texto;
        
        mensajesDiv.innerHTML = '';
        mensajesDiv.appendChild(mensaje);
    }

    function mostrarProgreso(mostrar) {
        if (mostrar) {
            progresoDiv.style.display = 'block';
            barraProgreso.style.width = '100%';
            textoProgreso.textContent = 'Procesando...';
        } else {
            progresoDiv.style.display = 'none';
            barraProgreso.style.width = '0%';
        }
    }
});