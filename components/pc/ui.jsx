import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PetCareTheme } from '@/constants/petcare-theme';

export function Screen({ title, subtitle, scroll = true, right, children, contentStyle }) {
  const Wrapper = scroll ? ScrollView : View;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Wrapper
        style={styles.wrapper}
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right ? <View>{right}</View> : null}
        </View>
        {children}
      </Wrapper>
    </SafeAreaView>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Label({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, autoCapitalize = 'none' }) {
  return (
    <View style={styles.fieldWrap}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={PetCareTheme.colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }) {
  const variantStyles = buttonVariants[variant] || buttonVariants.primary;
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonBase,
        variantStyles.button,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !(disabled || loading) && styles.buttonPressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={variantStyles.text.color} />
      ) : (
        <Text style={[styles.buttonText, variantStyles.text]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Chip({ label, tone = 'default' }) {
  const toneStyle = chipTones[tone] || chipTones.default;
  return (
    <View style={[styles.chip, toneStyle.bg, toneStyle.border]}>
      <Text style={[styles.chipText, toneStyle.text]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, description }) {
  return (
    <Card style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyText}>{description}</Text> : null}
    </Card>
  );
}

export function ErrorText({ children }) {
  if (!children) {
    return null;
  }

  return <Text style={styles.errorText}>{children}</Text>;
}

const buttonVariants = {
  primary: {
    button: {
      backgroundColor: PetCareTheme.colors.primary,
      borderColor: PetCareTheme.colors.primaryDark,
      shadowColor: '#145A50',
      shadowOpacity: 0.16,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    text: {
      color: '#fff',
    },
  },
  secondary: {
    button: {
      backgroundColor: PetCareTheme.colors.bgSoft,
      borderColor: PetCareTheme.colors.borderStrong,
    },
    text: {
      color: PetCareTheme.colors.text,
    },
  },
  danger: {
    button: {
      backgroundColor: '#FFF1F3',
      borderColor: '#F2C7CE',
    },
    text: {
      color: PetCareTheme.colors.danger,
    },
  },
};

const chipTones = {
  default: {
    bg: { backgroundColor: PetCareTheme.colors.chipBg },
    border: { borderColor: '#DDE8EF' },
    text: { color: PetCareTheme.colors.textMuted },
  },
  primary: {
    bg: { backgroundColor: PetCareTheme.colors.primarySoft },
    border: { borderColor: '#CFEAE1' },
    text: { color: PetCareTheme.colors.primary },
  },
  warning: {
    bg: { backgroundColor: '#FFF1D6' },
    border: { borderColor: '#F2DFC0' },
    text: { color: PetCareTheme.colors.warning },
  },
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PetCareTheme.colors.bg,
  },
  wrapper: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 36,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 2,
  },
  title: {
    fontSize: 29,
    fontWeight: '700',
    color: PetCareTheme.colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: PetCareTheme.colors.textMuted,
    lineHeight: 19,
    maxWidth: '96%',
  },
  card: {
    backgroundColor: PetCareTheme.colors.surface,
    borderRadius: PetCareTheme.radius.lg,
    borderWidth: 1,
    borderColor: PetCareTheme.colors.border,
    padding: 14,
    gap: 10,
    shadowColor: '#132A39',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldWrap: {
    gap: 6,
  },
  label: {
    color: PetCareTheme.colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  input: {
    minHeight: 46,
    borderRadius: PetCareTheme.radius.md,
    borderWidth: 1,
    borderColor: PetCareTheme.colors.borderStrong,
    backgroundColor: '#FBFDFF',
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: PetCareTheme.colors.text,
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  buttonBase: {
    minHeight: 47,
    borderRadius: PetCareTheme.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  buttonText: {
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.1,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FBFDFF',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: PetCareTheme.colors.text,
  },
  emptyText: {
    color: PetCareTheme.colors.textMuted,
    lineHeight: 19,
    fontSize: 13,
  },
  errorText: {
    color: PetCareTheme.colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
});
