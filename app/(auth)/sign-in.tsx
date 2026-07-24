import React, { useState } from 'react';
import { Alert, Platform, View, Text } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '@/providers/AuthProvider';
import {
  Screen,
  Eyebrow,
  Title,
  Subtitle,
  Label,
  Field,
  PrimaryButton,
  GhostButton,
} from '@/components/ui';

export default function SignInScreen() {
  const { t } = useTranslation();
  const { user, signIn, signInWithApple, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Redirect href="/(tabs)/calendar" />;

  const onSubmit = async () => {
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e) {
      Alert.alert(t('appName'), e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const onApple = async () => {
    setLoading(true);
    try {
      await signInWithApple();
    } catch (e) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert(t('appName'), e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen className="justify-center pb-12">
      <Eyebrow>Welcome</Eyebrow>
      <Title>{t('appName')}</Title>
      <Subtitle>{t('tagline')}</Subtitle>
      {!configured ? (
        <Text className="mt-5 rounded-[20px] bg-sage-mist px-4 py-3 text-sm text-ink-muted leading-5">
          Add Firebase keys to `.env` to enable sign-in. See `.env.example`.
        </Text>
      ) : null}
      <Label>{t('email')}</Label>
      <Field
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
      />
      <Label>{t('password')}</Label>
      <Field secureTextEntry value={password} onChangeText={setPassword} placeholder="••••••••" />
      <PrimaryButton label={t('signIn')} loading={loading} onPress={onSubmit} disabled={!configured} />
      {Platform.OS === 'ios' ? (
        <View className="mt-5">
          <Text className="mb-3 text-center text-sm text-ink-faint">{t('or')}</Text>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={999}
            style={{ width: '100%', height: 52 }}
            onPress={onApple}
          />
        </View>
      ) : null}
      <Link href="/(auth)/sign-up" asChild>
        <GhostButton label={t('signUp')} />
      </Link>
    </Screen>
  );
}
