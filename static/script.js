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
            const file = this.files[0];
            
            // Leer el archivo para contar los DNIs
            const reader = new FileReader();
            reader.onload = function(e) {
                const content = e.target.result;
                const lineas = content.split('\n').filter(line => line.trim() !== '');
                const cantidadDnis = lineas.length;
                
                if (cantidadDnis > 500) {
                    mostrarMensaje(`❌ El archivo tiene ${cantidadDnis} DNIs. Máximo permitido: 500.`, 'error');
                    procesarBtn.disabled = true;
                } else if (cantidadDnis > 100) {
                    mostrarMensaje(`📊 Archivo seleccionado: ${file.name} (${cantidadDnis} DNIs - Tiempo estimado: ${Math.ceil(cantidadDnis/100)}-${Math.ceil(cantidadDnis/50)} minutos)`, 'info');
                } else {
                    mostrarMensaje(`📊 Archivo seleccionado: ${file.name} (${cantidadDnis} DNIs)`, 'info');
                }
            };
            reader.readAsText(file);
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
        
        // Leer archivo para mostrar tiempo estimado
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            const lineas = content.split('\n').filter(line => line.trim() !== '');
            const cantidadDnis = lineas.length;
            
            if (cantidadDnis > 100) {
                mostrarMensaje(`⏳ Procesando ${cantidadDnis} DNIs... Esto puede tomar ${Math.ceil(cantidadDnis/100)}-${Math.ceil(cantidadDnis/50)} minutos. Por favor no cierre esta página.`, 'info');
            } else {
                mostrarMensaje(`⏳ Procesando ${cantidadDnis} DNIs... Esto puede tomar hasta 2 minutos.`, 'info');
            }
        };
        reader.readAsText(file);

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
                // Si es error 400, mostrar mensaje específico
                if (response.status === 400) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error en la solicitud');
                }
                throw new Error('Error en el servidor. Timeout excedido.');
            }

            const blob = await response.blob();
            
            // Verificar si el blob está vacío
            if (blob.size === 0) {
                throw new Error('El archivo resultante está vacío');
            }
            
            // Crear enlace para descargar el archivo
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `resultados_dnis_${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            
            // Leer archivo nuevamente para mostrar resultado final
            const readerFinal = new FileReader();
            readerFinal.onload = function(e) {
                const content = e.target.result;
                const lineas = content.split('\n').filter(line => line.trim() !== '');
                const cantidadDnis = lineas.length - 1; // -1 por el header
                
                mostrarMensaje(`✅ Procesamiento completado! Se procesaron ${cantidadDnis} DNIs. El archivo "resultados_dnis.csv" se está descargando.`, 'exito');
            };
            readerFinal.readAsText(blob);
            
        } catch (error) {
            console.error('Error:', error);
            
            // Mensajes de error específicos
            if (error.message.includes('Timeout') || error.message.includes('timeout')) {
                mostrarMensaje('❌ Tiempo de espera agotado. El procesamiento de muchos DNIs puede tomar varios minutos. Por favor intenta con menos DNIs o vuelve a intentarlo.', 'error');
            } else if (error.message.includes('Máximo 500')) {
                mostrarMensaje('❌ ' + error.message, 'error');
            } else if (error.message.includes('Error en el servidor')) {
                mostrarMensaje('❌ El servidor está tardando demasiado en responder. Esto puede pasar con archivos muy grandes. Intenta con menos DNIs (máximo 500).', 'error');
            } else if (error.message.includes('vacío')) {
                mostrarMensaje('❌ No se generaron resultados. Verifica que tu archivo tenga DNIs válidos.', 'error');
            } else {
                mostrarMensaje('❌ Error al procesar el archivo: ' + error.message, 'error');
            }
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
        
        // Auto-scroll al mensaje
        mensaje.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function mostrarProgreso(mostrar) {
        if (mostrar) {
            progresoDiv.style.display = 'block';
            
            // Animación de la barra de progreso
            let progreso = 0;
            const intervalo = setInterval(() => {
                progreso += Math.random() * 10;
                if (progreso > 90) progreso = 90; // No llega al 100% hasta que termine
                barraProgreso.style.width = progreso + '%';
                
                if (!mostrar) {
                    clearInterval(intervalo);
                }
            }, 1000);
            
            // Guardar el intervalo para limpiarlo después
            progresoDiv.intervalo = intervalo;
            
            textoProgreso.textContent = 'Procesando DNIs...';
        } else {
            progresoDiv.style.display = 'none';
            barraProgreso.style.width = '0%';
            
            // Limpiar intervalo si existe
            if (progresoDiv.intervalo) {
                clearInterval(progresoDiv.intervalo);
            }
            
            textoProgreso.textContent = 'Procesando...';
        }
    }

    // Efectos visuales adicionales
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
        });
        
        btn.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Mostrar mensaje de bienvenida
    setTimeout(() => {
        mostrarMensaje('👋 Bienvenido! Puedes procesar hasta 500 DNIs por archivo.', 'info');
    }, 1000);
});