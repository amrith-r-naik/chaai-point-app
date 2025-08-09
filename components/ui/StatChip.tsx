import React from 'react';
import { Text, View, ViewStyle } from 'react-native';

interface StatChipProps {
  label: string;
  value: string | number;
  subtle?: boolean;
  style?: ViewStyle;
  align?: 'left' | 'center' | 'right';
  icon?: React.ReactNode;
}

export const StatChip: React.FC<StatChipProps> = ({ label, value, subtle = false, style, align = 'center', icon }) => {
  return (
    <View
      style={{
        backgroundColor: subtle ? '#f8fafc' : '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        minWidth: 80,
        alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        ...style,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#0f172a' }}>{value}</Text>
      <Text style={{ fontSize: 11, fontWeight: '500', color: '#64748b', marginTop: 2 }}>{label}</Text>
      {icon ? <View style={{ position: 'absolute', top: 6, right: 6 }}>{icon}</View> : null}
    </View>
  );
};
