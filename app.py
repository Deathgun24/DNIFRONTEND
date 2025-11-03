from flask import Flask, request, jsonify, send_file
import requests
import time
import csv
import os
import io

app = Flask(__name__, static_folder='static', static_url_path='')

# Configuración
TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Im1pZ3VlbGFuZ2VsZ3V6bWFuaHVhbWFuNEBnbWFpbC5jb20ifQ.mVumiO3Dp2Km9U8CjMFqOhSfPOSsOTYgNjZZEy3M-EQ"
TIEMPO_ESPERA = 1


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

        # Limitar cantidad de DNIs para evitar timeout
        if len(dnis) > 50:
            return jsonify({'error': 'Máximo 50 DNIs por archivo'}), 400

        # Procesar DNIs
        resultados = []
        for i, dni in enumerate(dnis, 1):
            print(f"Procesando {i}/{len(dnis)}: DNI {dni}")
            resultado = consultar_dni(dni)
            resultados.append(resultado)
            time.sleep(TIEMPO_ESPERA)

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
