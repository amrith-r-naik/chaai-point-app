import React from 'react';
import { Text, View, ViewStyle } from 'react-native';

export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'indigo' | 'purple';
export type BadgeSize = 'sm' | 'md';

const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  neutral: { bg: '#f1f5f9', text: '#334155', border: '#e2e8f0' },
  info: { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' },
  success: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  warning: { bg: '#fef9c3', text: '#92400e', border: '#fde68a' },
  danger: { bg: '#ffe4e6', text: '#991b1b', border: '#fecdd3' },
  indigo: { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' },
  purple: { bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' },
};

const sizeStyles: Record<BadgeSize, { px: number; py: number; textSize: number }> = {
  sm: { px: 6, py: 2, textSize: 11 },
  md: { px: 8, py: 4, textSize: 12 },
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
  bordered?: boolean;
  uppercase?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  style,
  bordered = true,
  uppercase = false,
}) => {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  return (
    <View
      style={{
        backgroundColor: v.bg,
        paddingHorizontal: s.px,
        paddingVertical: s.py,
        borderRadius: 999,
        borderWidth: bordered ? 1 : 0,
        borderColor: v.border,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        ...style,
      }}
    >
      <Text
        style={{
          color: v.text,
          fontSize: s.textSize,
          fontWeight: '600',
          textTransform: uppercase ? 'uppercase' : 'none',
          letterSpacing: 0.5,
        }}
      >
        {children}
      </Text>
    </View>
  );
};
