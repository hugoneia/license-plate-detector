#!/usr/bin/env python3
"""
Script para descifrar archivos CSV exportados desde la aplicación Detector de Matrículas.

Uso:
    python3 descifrar_csv.py <archivo_cifrado.csv> <contraseña>

Ejemplo:
    python3 descifrar_csv.py matriculas_cifradas.csv "MiClave2026"

El script genera un archivo con sufijo "_DESCIFRADO.csv" en el mismo directorio.
"""

import sys
import csv
import base64
from Crypto.Cipher import AES
from Crypto.Protocol.KDF import PBKDF2
from Crypto.Random import get_random_bytes
import hashlib
import json
import re


def derive_key(password: str, salt: bytes) -> bytes:
    """
    Deriva una clave de cifrado desde una contraseña usando PBKDF2.
    Compatible con CryptoJS.
    """
    return PBKDF2(password, salt, dkLen=32, count=1, hmac_hash_module=hashlib.sha256)


def decrypt_aes_cbc(ciphertext_b64: str, password: str) -> str:
    """
    Descifra texto cifrado con AES-256-CBC en formato CryptoJS.
    
    CryptoJS genera: "U2FsdGVkX1..." donde:
    - "U2FsdGVkX1" es el prefijo "Salted__" en Base64
    - Los siguientes 8 bytes son el salt
    - El resto es el ciphertext
    """
    try:
        # Decodificar Base64
        encrypted_data = base64.b64decode(ciphertext_b64)
        
        # Verificar prefijo "Salted__"
        if encrypted_data[:8] != b'Salted__':
            raise ValueError("Formato de cifrado inválido: falta prefijo 'Salted__'")
        
        # Extraer salt (8 bytes después del prefijo)
        salt = encrypted_data[8:16]
        
        # Extraer ciphertext
        ciphertext = encrypted_data[16:]
        
        # Derivar clave desde la contraseña
        key = derive_key(password, salt)
        
        # Descifrar usando AES-256-CBC
        # IV es cero en CryptoJS por defecto
        iv = b'\x00' * 16
        cipher = AES.new(key, AES.MODE_CBC, iv)
        plaintext = cipher.decrypt(ciphertext)
        
        # Remover padding PKCS7
        padding_length = plaintext[-1]
        plaintext = plaintext[:-padding_length]
        
        return plaintext.decode('utf-8')
    
    except Exception as e:
        return None


def process_csv(input_file: str, password: str, output_file: str) -> bool:
    """
    Lee un CSV cifrado y genera uno descifrado.
    """
    try:
        print(f"📂 Procesando archivo: {input_file}")
        print(f"🔐 Usando contraseña: {'*' * len(password)}")
        
        decrypted_rows = []
        error_count = 0
        success_count = 0
        
        # Leer CSV cifrado
        with open(input_file, 'r', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)
            
            if not reader.fieldnames:
                print("❌ Error: CSV vacío o sin encabezados")
                return False
            
            print(f"📋 Encabezados encontrados: {', '.join(reader.fieldnames)}")
            
            for row_num, row in enumerate(reader, start=2):  # Empezar en 2 (1 es encabezado)
                try:
                    # Copiar fila
                    decrypted_row = row.copy()
                    
                    # Descifrar matrícula si existe
                    if 'MATRÍCULA' in row and row['MATRÍCULA']:
                        encrypted_plate = row['MATRÍCULA'].strip()
                        
                        # Intentar descifrar
                        decrypted_plate = decrypt_aes_cbc(encrypted_plate, password)
                        
                        if decrypted_plate:
                            decrypted_row['MATRÍCULA'] = decrypted_plate
                            success_count += 1
                            print(f"✓ Fila {row_num}: {encrypted_plate[:20]}... → {decrypted_plate}")
                        else:
                            error_count += 1
                            print(f"✗ Fila {row_num}: No se pudo descifrar (contraseña incorrecta?)")
                            decrypted_row['MATRÍCULA'] = encrypted_plate
                    
                    decrypted_rows.append(decrypted_row)
                
                except Exception as e:
                    error_count += 1
                    print(f"✗ Fila {row_num}: Error procesando - {str(e)}")
                    decrypted_rows.append(row)
        
        # Escribir CSV descifrado
        with open(output_file, 'w', newline='', encoding='utf-8') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=reader.fieldnames)
            writer.writeheader()
            writer.writerows(decrypted_rows)
        
        # Resumen
        print(f"\n{'='*60}")
        print(f"✅ Archivo generado con éxito: {output_file}")
        print(f"📊 Resultados:")
        print(f"   - Matrículas descifradas: {success_count}")
        print(f"   - Errores: {error_count}")
        print(f"   - Total de filas: {len(decrypted_rows)}")
        print(f"{'='*60}\n")
        
        return True
    
    except FileNotFoundError:
        print(f"❌ Error: Archivo no encontrado: {input_file}")
        return False
    except Exception as e:
        print(f"❌ Error procesando CSV: {str(e)}")
        return False


def main():
    """Función principal."""
    if len(sys.argv) < 3:
        print(__doc__)
        print("Ejemplo de uso:")
        print("  python3 descifrar_csv.py matriculas_cifradas.csv MiContraseña2026")
        sys.exit(1)
    
    input_file = sys.argv[1]
    password = sys.argv[2]
    output_file = input_file.replace('.csv', '_DESCIFRADO.csv')
    
    # Validar que el archivo existe
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            pass
    except FileNotFoundError:
        print(f"❌ Error: Archivo no encontrado: {input_file}")
        sys.exit(1)
    
    # Procesar
    success = process_csv(input_file, password, output_file)
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
