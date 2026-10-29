import React from 'react';
import { StatusBar, Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './global.css';
import { AuthProvider } from './src/context/AuthContext';
import { PatientProvider } from './src/context/PatientContext';
import { RootNavigator } from './src/navigation/RootNavigator';

interface DefaultPropsTarget {
  defaultProps?: {
    style?: unknown;
  };
}

const TextWithDefaults = Text as unknown as DefaultPropsTarget;
TextWithDefaults.defaultProps = TextWithDefaults.defaultProps || {};
TextWithDefaults.defaultProps.style = [{ fontFamily: 'RedditSans' }, TextWithDefaults.defaultProps.style];

const TextInputWithDefaults = TextInput as unknown as DefaultPropsTarget;
TextInputWithDefaults.defaultProps = TextInputWithDefaults.defaultProps || {};
TextInputWithDefaults.defaultProps.style = [
  { fontFamily: 'RedditSans' },
  TextInputWithDefaults.defaultProps.style,
];

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AuthProvider>
        <PatientProvider>
          <RootNavigator />
        </PatientProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
