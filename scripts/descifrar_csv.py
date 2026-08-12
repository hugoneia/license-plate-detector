#!/usr/bin/env python3
"""
Script para descifrar archivos CSV exportados desde la aplicación Detector de Matrículas.

Primero instalar en sistema: pip3 install pycryptodome

Uso:
    python3 descifrar_csv.py <archivo_cifrado.csv> <contraseña>

Ejemplo:
    python3 descifrar_csv.py matriculas_cifradas.csv "MiClave2026"

El script genera un archivo con sufijo "_DESCIFRADO.csv" en el mismo directorio.
"""

import sys
import os
import base64
import csv
import json
from hashlib import md5
from Crypto.Cipher import AES

def bytes_to_key(data: bytes, salt: bytes, key_len=32, iv_len=16):
    """Deriva la clave e IV al estilo OpenSSL/CryptoJS (EVP_BytesToKey)."""
    dt = b''
    d = b''
    while len(dt) < key_len + iv_len:
        d = md5(d + data + salt).digest()
        dt += d
    return dt[:key_len], dt[key_len:key_len + iv_len]

def decrypt_cryptojs(encrypted_b64: str, password: str) -> str:
    """Descifra una cadena cifrada con CryptoJS.AES."""
    if not encrypted_b64 or not isinstance(encrypted_b64, str):
        return encrypted_b64

    try:
        encrypted_bytes = base64.b64decode(encrypted_b64)
        
        # Comprobar cabecera OpenSSL 'Salted__'
        if len(encrypted_bytes) < 16 or encrypted_bytes[:8] != b'Salted__':
            return encrypted_b64  # No cifrado o texto plano

        salt = encrypted_bytes[8:16]
        ciphertext = encrypted_bytes[16:]

        key, iv = bytes_to_key(password.encode('utf-8'), salt)
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted = cipher.decrypt(ciphertext)

        # Retirar relleno PKCS7
        pad_len = decrypted[-1]
        if pad_len < 1 or pad_len > 16:
            return encrypted_b64

        return decrypted[:-pad_len].decode('utf-8')
    except Exception:
        return encrypted_b64

def decrypt_file(input_file: str, password: str):
    if not os.path.exists(input_file):
        print(f"❌ Error: El archivo '{input_file}' no existe.")
        return

    # Genera la ruta de salida conservando directorio y extensión (_DESCIFRADO.csv)
    filename, ext = os.path.splitext(input_file)
    output_file = f"{filename}_DESCIFRADO{ext}"

    target_keys = {'licenseplate', 'license_plate', 'matricula', 'matrícula', 'plate'}

    if input_file.lower().endswith('.csv'):
        with open(input_file, mode='r', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)
            fieldnames = reader.fieldnames
            rows = []
            
            for row in reader:
                for key in row.keys():
                    if key and key.lower() in target_keys:
                        row[key] = decrypt_cryptojs(row[key], password)
                rows.append(row)

        with open(output_file, mode='w', encoding='utf-8', newline='') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    elif input_file.lower().endswith('.json'):
        with open(input_file, mode='r', encoding='utf-8') as infile:
            data = json.load(infile)

        def process_node(node):
            if isinstance(node, list):
                return [process_node(item) for item in node]
            elif isinstance(node, dict):
                new_dict = {}
                for k, v in node.items():
                    if k.lower() in target_keys and isinstance(v, str):
                        new_dict[k] = decrypt_cryptojs(v, password)
                    else:
                        new_dict[k] = process_node(v)
                return new_dict
            return node

        decrypted_data = process_node(data)

        with open(output_file, mode='w', encoding='utf-8') as outfile:
            json.dump(decrypted_data, outfile, ensure_ascii=False, indent=2)

    else:
        print("❌ Error: Formato no soportado. Debe ser un archivo .csv o .json")
        return

    print(f"✅ Descifrado completado: {output_file}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python descifrar.py <archivo> <contraseña>")
        sys.exit(1)

    archivo_param = sys.argv[1]
    clave_param = sys.argv[2]

    decrypt_file(archivo_param, clave_param)