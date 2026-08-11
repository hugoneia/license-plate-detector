import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { isBiometricEnabled, verifyPinCode } from '@/lib/crypto';
import { useColors } from '@/hooks/use-colors';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const colors = useColors();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face' | null>(null);

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const biometricEnabled = await isBiometricEnabled();

      if (compatible && enrolled && biometricEnabled) {
        setBiometricAvailable(true);
        
        // Detectar tipo de biometría
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('face');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('fingerprint');
        }

        // Intentar autenticación biométrica automáticamente
        attemptBiometricAuth();
      }
    } catch (error) {
      console.error('Error verificando biometría:', error);
    }
  };

  const attemptBiometricAuth = async () => {
    try {
      setLoading(true);
      const result = await LocalAuthentication.authenticateAsync();

      if (result.success) {
        onUnlock();
      }
    } catch (error) {
      console.error('Error en autenticación biométrica:', error);
      setError('Autenticación fallida. Usa el PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinPress = (digit: string) => {
    if (pin.length < 4) {
      setPin(pin + digit);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 4) {
      setError('El PIN debe tener 4 dígitos');
      return;
    }

    try {
      setLoading(true);
      const isValid = await verifyPinCode(pin);

      if (isValid) {
        onUnlock();
      } else {
        setError('PIN incorrecto');
        setPin('');
      }
    } catch (error) {
      console.error('Error verificando PIN:', error);
      setError('Error al verificar PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}
    >
      {/* Encabezado */}
      <View style={{ marginBottom: 40, alignItems: 'center' }}>
        <MaterialIcons name="lock" size={64} color={colors.primary} />
        <Text
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: colors.foreground,
            marginTop: 16,
          }}
        >
          Aplicación Bloqueada
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: colors.muted,
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          {biometricType === 'face'
            ? 'Usa Face ID o ingresa tu PIN'
            : biometricType === 'fingerprint'
            ? 'Usa tu huella o ingresa tu PIN'
            : 'Ingresa tu PIN de 4 dígitos'}
        </Text>
      </View>

      {/* Botón de Biometría */}
      {biometricAvailable && !loading && (
        <TouchableOpacity
          onPress={attemptBiometricAuth}
          style={{
            paddingVertical: 16,
            paddingHorizontal: 32,
            borderRadius: 12,
            backgroundColor: colors.primary,
            marginBottom: 32,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <MaterialIcons
            name={biometricType === 'face' ? 'face' : 'fingerprint'}
            size={24}
            color="white"
          />
          <Text
            style={{
              color: 'white',
              fontSize: 16,
              fontWeight: '600',
            }}
          >
            {biometricType === 'face' ? 'Usar Face ID' : 'Usar Huella'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Indicador de PIN */}
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          marginBottom: 32,
          justifyContent: 'center',
        }}
      >
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: index < pin.length ? colors.primary : colors.surface,
              borderWidth: 2,
              borderColor: colors.border,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {index < pin.length && (
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: 'white',
                }}
              >
                •
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Mensaje de error */}
      {error && (
        <Text
          style={{
            color: colors.error,
            fontSize: 14,
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          {error}
        </Text>
      )}

      {/* Teclado numérico */}
      <View
        style={{
          width: '100%',
          maxWidth: 300,
        }}
      >
        {/* Fila 1 */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          {[1, 2, 3].map((num) => (
            <TouchableOpacity
              key={num}
              onPress={() => handlePinPress(num.toString())}
              disabled={loading || pin.length >= 4}
              style={{
                flex: 1,
                aspectRatio: 1,
                borderRadius: 12,
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderColor: colors.border,
                justifyContent: 'center',
                alignItems: 'center',
                opacity: loading || pin.length >= 4 ? 0.5 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: 'bold',
                  color: colors.foreground,
                }}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Fila 2 */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          {[4, 5, 6].map((num) => (
            <TouchableOpacity
              key={num}
              onPress={() => handlePinPress(num.toString())}
              disabled={loading || pin.length >= 4}
              style={{
                flex: 1,
                aspectRatio: 1,
                borderRadius: 12,
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderColor: colors.border,
                justifyContent: 'center',
                alignItems: 'center',
                opacity: loading || pin.length >= 4 ? 0.5 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: 'bold',
                  color: colors.foreground,
                }}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Fila 3 */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          {[7, 8, 9].map((num) => (
            <TouchableOpacity
              key={num}
              onPress={() => handlePinPress(num.toString())}
              disabled={loading || pin.length >= 4}
              style={{
                flex: 1,
                aspectRatio: 1,
                borderRadius: 12,
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderColor: colors.border,
                justifyContent: 'center',
                alignItems: 'center',
                opacity: loading || pin.length >= 4 ? 0.5 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: 'bold',
                  color: colors.foreground,
                }}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Fila 4: 0, Backspace, Enter */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={() => handlePinPress('0')}
            disabled={loading || pin.length >= 4}
            style={{
              flex: 1,
              aspectRatio: 1,
              borderRadius: 12,
              backgroundColor: colors.surface,
              borderWidth: 2,
              borderColor: colors.border,
              justifyContent: 'center',
              alignItems: 'center',
              opacity: loading || pin.length >= 4 ? 0.5 : 1,
            }}
          >
            <Text
              style={{
                fontSize: 28,
                fontWeight: 'bold',
                color: colors.foreground,
              }}
            >
              0
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleBackspace}
            disabled={loading || pin.length === 0}
            style={{
              flex: 1,
              aspectRatio: 1,
              borderRadius: 12,
              backgroundColor: colors.surface,
              borderWidth: 2,
              borderColor: colors.border,
              justifyContent: 'center',
              alignItems: 'center',
              opacity: loading || pin.length === 0 ? 0.5 : 1,
            }}
          >
            <MaterialIcons name="backspace" size={28} color={colors.foreground} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePinSubmit}
            disabled={loading || pin.length !== 4}
            style={{
              flex: 1,
              aspectRatio: 1,
              borderRadius: 12,
              backgroundColor: colors.primary,
              justifyContent: 'center',
              alignItems: 'center',
              opacity: loading || pin.length !== 4 ? 0.5 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <MaterialIcons name="check" size={28} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
