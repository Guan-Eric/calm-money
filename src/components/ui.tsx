import React from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  FlatList,
  type TextInputProps,
  type PressableProps,
  ActivityIndicator,
} from 'react-native';

export function Screen({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <View className={`flex-1 bg-canvas px-6 ${className}`}>{children}</View>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-xs font-medium uppercase tracking-[1.2px] text-ink-faint">{children}</Text>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text className="text-[34px] font-medium text-ink tracking-tight leading-10">{children}</Text>;
}

export function HeroAmount({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mt-1 text-[42px] font-medium text-ink tracking-tight leading-[48px]">{children}</Text>
  );
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text className="mt-2 text-[17px] text-ink-muted leading-6">{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text className="mb-2 mt-5 text-sm text-ink-muted">{children}</Text>;
}

export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor="#94908d"
      className="rounded-full border border-line bg-surface-raised px-5 py-4 text-[17px] text-ink"
      {...props}
    />
  );
}

export function PrimaryButton({
  label,
  loading,
  ...props
}: PressableProps & { label: string; loading?: boolean }) {
  return (
    <Pressable
      className={`mt-6 items-center rounded-full bg-ink px-5 py-4 ${props.disabled ? 'opacity-40' : ''}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="#fcfcfc" />
      ) : (
        <Text className="text-[17px] font-medium text-surface">{label}</Text>
      )}
    </Pressable>
  );
}

export function SoftButton({
  label,
  loading,
  ...props
}: PressableProps & { label: string; loading?: boolean }) {
  return (
    <Pressable
      className={`mt-3 items-center rounded-full bg-sage-mist px-5 py-4 ${props.disabled ? 'opacity-40' : ''}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="#486635" />
      ) : (
        <Text className="text-[17px] font-medium text-sage">{label}</Text>
      )}
    </Pressable>
  );
}

export function GhostButton({ label, ...props }: PressableProps & { label: string }) {
  return (
    <Pressable className="mt-2 items-center px-4 py-3" {...props}>
      <Text className="text-[17px] text-ink-soft">{label}</Text>
    </Pressable>
  );
}

export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View className="mt-5 flex-row rounded-full bg-dust/60 p-1">
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            className={`flex-1 items-center rounded-full py-2.5 ${active ? 'bg-surface-raised' : ''}`}
          >
            <Text className={`text-sm ${active ? 'font-medium text-ink' : 'text-ink-muted'}`}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function CardRow({
  title,
  subtitle,
  onPress,
  right,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mt-1 flex-row items-center justify-between border-b border-line py-4"
    >
      <View className="flex-1 pr-3">
        <Text className="text-[17px] text-ink">{title}</Text>
        {subtitle ? <Text className="mt-1 text-sm text-ink-muted leading-5">{subtitle}</Text> : null}
      </View>
      {right ?? <Text className="text-ink-faint">›</Text>}
    </Pressable>
  );
}

export function ActivityRow({
  title,
  subtitle,
  amount,
  color,
  onPress,
}: {
  title: string;
  subtitle?: string;
  amount: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center border-b border-line py-4">
      <View
        className="mr-3 h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: color }}
      >
        <Text className="text-base font-medium text-ink">{title.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View className="flex-1 pr-3">
        <Text className="text-[17px] text-ink" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-sm text-ink-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text className="text-[17px] font-medium text-ink">{amount}</Text>
    </Pressable>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose…',
}: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View>
      {label ? <Label>{label}</Label> : null}
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-full border border-line bg-surface-raised px-5 py-4"
      >
        <Text className={`text-[17px] ${selected ? 'text-ink' : 'text-ink-faint'}`}>
          {selected?.label ?? placeholder}
        </Text>
        <Text className="text-ink-faint">▾</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/30" onPress={() => setOpen(false)}>
          <Pressable
            className="max-h-[70%] rounded-t-[28px] bg-canvas px-2 pb-10 pt-3"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-2 items-center">
              <View className="h-1 w-10 rounded-full bg-line" />
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    className="flex-row items-center justify-between border-b border-line px-4 py-4"
                  >
                    <Text className={`text-[17px] ${active ? 'font-medium text-sage' : 'text-ink'}`}>
                      {item.label}
                    </Text>
                    {active ? <Text className="text-sage">✓</Text> : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}


export function SectionHeader({ children }: { children: React.ReactNode }) {
  return <Text className="mb-1 mt-8 text-xl font-medium text-ink tracking-tight">{children}</Text>;
}
