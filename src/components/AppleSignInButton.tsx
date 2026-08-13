import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/providers/ThemeProvider';
import { appleSignInBlockedReason, isAppleSignInAvailable } from '@/lib/appleAuth';

type Props = {
  onPress: () => void;
  disabled?: boolean;
  buttonType?: AppleAuthentication.AppleAuthenticationButtonType;
};

export function AppleSignInButton({
  onPress,
  disabled,
  buttonType = AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN,
}: Props) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const [available, setAvailable] = useState(false);
  const blocked = appleSignInBlockedReason();

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void isAppleSignInAvailable().then(setAvailable);
  }, []);

  if (Platform.OS !== 'ios' || !available) return null;

  const inactive = Boolean(disabled || blocked);

  return (
    <View className="mt-5" pointerEvents={inactive ? 'none' : 'auto'} style={{ opacity: inactive ? 0.45 : 1 }}>
      <Text className="mb-3 text-center text-sm text-ink-faint">{t('or')}</Text>
      {blocked ? (
        <Text className="mb-3 text-center text-sm text-ink-muted leading-5">{blocked}</Text>
      ) : null}
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={buttonType}
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
