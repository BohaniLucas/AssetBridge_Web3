import { AppRegistry, Platform } from 'react-native';
import App from './App';

// Root component registration for Expo Go, Android, iOS, and Web
AppRegistry.registerComponent('main', () => App);

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const rootTag = document.getElementById('root');
  if (rootTag) {
    AppRegistry.runApplication('main', { rootTag });
  }
}
