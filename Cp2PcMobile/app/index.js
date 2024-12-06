import { Stack } from 'expo-router';
import { View } from 'react-native';
import ServerDiscoveryScreen from './discovery';

export default function App() {
    return (
        <View style={{ flex: 1 }}>
            <Stack.Screen 
                options={{
                    title: "Cp2Pc Mobile",
                    headerStyle: {
                        backgroundColor: '#f4511e',
                    },
                    headerTintColor: '#fff',
                    headerTitleStyle: {
                        fontWeight: 'bold',
                    },
                }} 
            />
            <ServerDiscoveryScreen />
        </View>
    );
}
