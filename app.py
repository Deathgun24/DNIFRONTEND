from flask import Flask, request, jsonify, send_file
import requests
import time
import csv
import os
import io
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

app = Flask(__name__, static_folder='static', static_url_path='')

# Configuración
TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImRnMzQ5NDgxQGdtYWlsLmNvbSJ9.J4NYeuRupn5cZw8EsqjC01D0hNpTkQgKt1cp5Wri8Rw"
TIEMPO_ESPERA = 0.5  # Reducido a 0.5 segundos
MAX_DNIS = 500
WORKERS = 5  # Número de hilos paralelos


def consultar_dni(dni):
    url = f"https://dniruc.apisperu.com/api/v1/dni/{dni}?token={TOKEN}"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return {
                'dni': dni,
                'nombres': data.get('nombres', ''),
                'apellidoPaterno': data.get('apellidoPaterno', ''),
                'apellidoMaterno': data.get('apellidoMaterno', ''),
                'codVerifica': data.get('codVerifica', ''),
                'error': ''
            }
        else:
            return {
                'dni': dni,
                'nombres': '',
                'apellidoPaterno': '',
                'apellidoMaterno': '',
                'codVerifica': '',
                'error': f"Error {response.status_code}"
            }
    except Exception as e:
        return {
            'dni': dni,
            'nombres': '',
            'apellidoPaterno': '',
            'apellidoMaterno': '',
            'codVerifica': '',
            'error': str(e)
        }


def procesar_lote(dnis_lote):
    """Procesa un lote de DNIs en paralelo"""
    resultados = []
    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        # Enviar todas las consultas
        futures = {executor.submit(consultar_dni, dni)                   : dni for dni in dnis_lote}

        # Recolectar resultados a medida que terminan
        for future in as_completed(futures):
            try:
                resultado = future.result()
                resultados.append(resultado)
            except Exception as e:
                dni = futures[future]
                resultados.append({
                    'dni': dni,
                    'nombres': '',
                    'apellidoPaterno': '',
                    'apellidoMaterno': '',
                    'codVerifica': '',
                    'error': str(e)
                })
            time.sleep(TIEMPO_ESPERA)  # Pequeña pausa entre consultas

    return resultados


@app.route('/')
def serve_index():
    try:
        return app.send_static_file('index.html')
    except Exception as e:
        return f"Error loading page: {str(e)}", 500


@app.route('/<path:path>')
def serve_static(path):
    return app.send_static_file(path)


@app.route('/procesar-dnis', methods=['POST'])
def procesar_dnis():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No se proporcionó archivo'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No se seleccionó archivo'}), 400

        # Validar tipo de archivo
        if not file.filename.lower().endswith(('.csv', '.txt')):
            return jsonify({'error': 'Solo se permiten archivos CSV o TXT'}), 400

        # Leer DNIs del archivo
        content = file.read().decode('utf-8-sig')
        dnis = [line.strip() for line in content.splitlines() if line.strip()]

        # 🔥 Aumentado a 500 DNIs
        if len(dnis) > MAX_DNIS:
            return jsonify({'error': f'Máximo {MAX_DNIS} DNIs permitidos. Tu archivo tiene {len(dnis)} DNIs.'}), 400

        # Procesar en lotes más pequeños
        tamaño_lote = 50
        lotes = [dnis[i:i + tamaño_lote]
                 for i in range(0, len(dnis), tamaño_lote)]

        resultados = []
        for i, lote in enumerate(lotes, 1):
            print(f"Procesando lote {i}/{len(lotes)} - {len(lote)} DNIs")
            resultados_lote = procesar_lote(lote)
            resultados.extend(resultados_lote)

        # Crear archivo CSV en memoria
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=[
            'dni', 'nombres', 'apellidoPaterno', 'apellidoMaterno', 'codVerifica', 'error'
        ])
        writer.writeheader()
        writer.writerows(resultados)

        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/csv',
            as_attachment=True,
            download_name='resultados_dnis.csv'
        )

    except Exception as e:
        print(f"Error general: {str(e)}")
        return jsonify({'error': f'Error procesando archivo: {str(e)}'}), 500


@app.route('/descargar-formato', methods=['GET'])
def descargar_formato():
    try:
        # Crear un archivo de ejemplo
        output = io.StringIO()
        output.write("DNI\n")
        output.write("12345678\n")
        output.write("87654321\n")

        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/csv',
            as_attachment=True,
            download_name='formato_dnis.csv'
        )
    except Exception as e:
        return jsonify({'error': f'Error creating format file: {str(e)}'}), 500


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'API is working'}), 200


# Esto es importante para Railway
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
