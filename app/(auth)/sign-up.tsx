import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
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

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { user, signUp, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Redirect href="/(tabs)/calendar" />;

  const onSubmit = async () => {
    setLoading(true);
    try {
      await signUp(email, password);
    } catch (e) {
      Alert.alert(t('appName'), e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen className="justify-center pb-12">
      <Eyebrow>Get started</Eyebrow>
      <Title>{t('signUp')}</Title>
      <Subtitle>{t('tagline')}</Subtitle>
      <Label>{t('email')}</Label>
      <Field
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
      />
      <Label>{t('password')}</Label>
      <Field
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="At least 6 characters"
      />
      <PrimaryButton label={t('signUp')} loading={loading} onPress={onSubmit} disabled={!configured} />
      <Link href="/(auth)/sign-in" asChild>
        <GhostButton label={t('signIn')} />
      </Link>
    </Screen>
  );
}
