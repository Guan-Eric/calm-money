import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/providers/ThemeProvider';
import { isAppleSignInAvailable } from '@/lib/appleAuth';

type Props = {
  onPress: () => void;
  disabled?: boolean;
};

export function AppleSignInButton({ onPress, disabled }: Props) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void isAppleSignInAvailable().then(setAvailable);
  }, []);

  if (Platform.OS !== 'ios' || !available) return null;

  return (
    <View className="mt-5" pointerEvents={disabled ? 'none' : 'auto'} style={{ opacity: disabled ? 0.45 : 1 }}>
      <Text className="mb-3 text-center text-sm text-ink-faint">{t('or')}</Text>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={
          resolvedTheme === 'dark'
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={999}
        style={{ width: '100%', height: 52 }}
        onPress={onPress}
      />
    </View>
  );
}
