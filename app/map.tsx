import { View, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';

export default function MapScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: 'red' }}>
      <View style={{ height: 60, backgroundColor: 'black', justifyContent: 'center', padding: 10 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: 'white' }}>VOLVER (SI VES ESTO, LA PANTALLA CARGA)</Text>
        </TouchableOpacity>
      </View>
      <WebView 
        source={{ html: '<body style="background: yellow;"><h1>EL WEBVIEW FUNCIONA</h1></body>' }}
        style={{ flex: 1 }}
      />
    </View>
  );
}
