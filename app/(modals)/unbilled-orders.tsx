import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { SafeAreaView, Text, TouchableOpacity } from 'react-native';

export default function UnbilledOrdersDeprecated() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Stack.Screen options={{ title: 'Unbilled Orders (Removed)' }} />
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Feature Removed</Text>
      <Text style={{ fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 20, maxWidth: 320 }}>
        Unbilled KOT tracking has been removed. All new KOTs are immediately considered in billing or credit.
      </Text>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Go Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
