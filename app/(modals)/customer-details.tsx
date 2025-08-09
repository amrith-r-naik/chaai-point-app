import { theme } from '@/constants/theme';
import { db } from '@/lib/db';
import { formatCurrency } from '@/lib/money';
import { authState } from '@/state/authState';
import { use$ } from '@legendapp/state/react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface BillRow { id: string; billNumber: string; total: number; createdAt: string; paid: number; credit: number; }
interface PaymentRow { id: string; billId: string | null; mode: string; amount: number; createdAt: string; }
interface Snapshot {
  customer: { id: string; name: string; contact?: string | null; creditBalance: number; createdAt: string; } | null;
  totalBilled: number;
  totalPaid: number;
  totalCredit: number; // outstanding
  recentBills: BillRow[];
  recentPayments: PaymentRow[];
  unbilledKotCount: number;
  unbilledKotAmount: number;
  loading: boolean;
  error?: string;
}

const MAX_RECENT = 5;

export default function CustomerDetailsScreen() {
  const router = useRouter();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const auth = use$(authState);
  const [snap, setSnap] = useState<Snapshot>({
    customer: null,
    totalBilled: 0,
    totalPaid: 0,
    totalCredit: 0,
    recentBills: [],
    recentPayments: [],
    unbilledKotCount: 0,
    unbilledKotAmount: 0,
    loading: true,
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!db || !auth.isDbReady || !customerId) return;
    setSnap(s => ({ ...s, loading: true, error: undefined }));
    try {
      // Parallel basic fetches
      const [customerRow] = await db.getAllAsync(`SELECT id, name, contact, creditBalance, createdAt FROM customers WHERE id = ?`, [customerId]) as any[];
      if (!customerRow) {
        setSnap(s => ({ ...s, loading: false, error: 'Customer not found' }));
        return;
      }
      const bills = await db.getAllAsync(`SELECT id, billNumber, total, createdAt FROM bills WHERE customerId = ? ORDER BY createdAt DESC`, [customerId]) as any[];
      const payments = await db.getAllAsync(`SELECT id, billId, mode, amount, createdAt FROM payments WHERE customerId = ? ORDER BY createdAt DESC`, [customerId]) as any[];
      const today = new Date();
      const todayStr = new Date(today.getTime()).toISOString().split('T')[0];
      const unbilledRows = await db.getAllAsync(`SELECT ko.id, SUM(ki.quantity * ki.priceAtTime) as total FROM kot_orders ko LEFT JOIN kot_items ki ON ko.id = ki.kotId WHERE ko.customerId = ? AND ko.billId IS NULL AND (ko.businessDate = ? OR (ko.businessDate IS NULL AND DATE(ko.createdAt)=DATE(?))) GROUP BY ko.id`, [customerId, todayStr, todayStr]) as any[];

      // Build bill payment map
      const billMap: Record<string, BillRow> = {};
      bills.forEach(b => { billMap[b.id] = { id: b.id, billNumber: b.billNumber, total: b.total || 0, createdAt: b.createdAt, paid: 0, credit: 0 }; });
      let totalPaid = 0; let totalCreditComp = 0; // computed credit portions
      payments.forEach(p => {
        if (p.billId && billMap[p.billId]) {
          if (p.mode === 'Credit') { billMap[p.billId].credit += p.amount; totalCreditComp += p.amount; } else { billMap[p.billId].paid += p.amount; totalPaid += p.amount; }
        } else {
          // Non-billed credit adjustments or future settlements (ignore for now except totals)
          if (p.mode === 'Credit') totalCreditComp += p.amount; else totalPaid += p.amount;
        }
      });

      const totalBilled = bills.reduce((s, b) => s + (b.total || 0), 0);
      const creditBalance = customerRow.creditBalance || 0; // authoritative outstanding

      const recentBills = Object.values(billMap)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, MAX_RECENT);

      const recentPayments: PaymentRow[] = payments.slice(0, MAX_RECENT);

      const unbilledKotCount = unbilledRows.length;
      const unbilledKotAmount = unbilledRows.reduce((s, r) => s + (r.total || 0), 0);

      setSnap({
        customer: customerRow,
        totalBilled,
        totalPaid,
        totalCredit: creditBalance,
        recentBills,
        recentPayments,
        unbilledKotCount,
        unbilledKotAmount,
        loading: false,
      });
    } catch (e: any) {
      setSnap(s => ({ ...s, loading: false, error: e.message || 'Failed to load' }));
    }
  }, [customerId, auth.isDbReady]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  const goBillNow = () => {
    if (snap.unbilledKotCount === 0) return;
    router.push({ pathname: '/(modals)/customer-bill', params: { customerId: snap.customer?.id, customerName: snap.customer?.name, date: new Date().toISOString().split('T')[0] } });
  };

  const startPayment = () => {
    // Quick path: if there are unbilled KOTs encourage bill now; else no direct payment here (payments happen via bill flow)
    if (snap.unbilledKotCount > 0) goBillNow();
  };

  const openKots = () => {
    router.push('/(modals)/customer-kots');
  };

  if (snap.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f9fafb', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size='large' color='#2563eb' />
      </View>
    );
  }

  if (snap.error || !snap.customer) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f9fafb', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text, marginBottom: 8 }}>Error</Text>
        <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16 }}>{snap.error || 'Customer not found'}</Text>
        <TouchableOpacity onPress={load} style={{ backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '500' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <Stack.Screen options={{
        title: snap.customer.name, headerStyle: { backgroundColor: 'white' }, headerTitleStyle: { fontSize: 18, fontWeight: '600', color: theme.colors.text }, headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8, borderRadius: 8 }}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
        ), headerShadowVisible: true
      }} />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Summary Row */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <SummaryCard label='Billed' value={formatCurrency(snap.totalBilled)} />
          <SummaryCard label='Paid' value={formatCurrency(snap.totalPaid)} variant='success' />
          <SummaryCard label='Credit' value={formatCurrency(snap.totalCredit)} variant={snap.totalCredit > 0 ? 'warning' : undefined} />
          {snap.unbilledKotCount > 0 && <SummaryCard label='Unbilled' value={formatCurrency(snap.unbilledKotAmount)} variant='info' footer={`${snap.unbilledKotCount} KOT`} />}
        </View>

        {/* Quick Actions */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          <ActionBtn label='KOTs' onPress={openKots} />
          {snap.unbilledKotCount > 0 && <ActionBtn label='Bill Now' onPress={goBillNow} primary />}
        </View>

        {/* Recent Bills */}
        <Section title='Recent Bills'>
          {snap.recentBills.length === 0 ? <EmptyLine text='No bills yet' /> : snap.recentBills.map(b => (
            <TouchableOpacity key={b.id} style={rowStyle}>
              <View style={{ flex: 1 }}>
                <Text style={rowTitle}>Bill #{b.billNumber}</Text>
                <Text style={rowSub}>{new Date(b.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={rowAmount}>{formatCurrency(b.total)}</Text>
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{b.paid > 0 ? `Paid ${formatCurrency(b.paid)}` : 'No pay'} {b.credit > 0 ? `| Cr ${formatCurrency(b.credit)}` : ''}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Section>

        {/* Recent Payments */}
        <Section title='Recent Payments'>
          {snap.recentPayments.length === 0 ? <EmptyLine text='No payments yet' /> : snap.recentPayments.map(p => (
            <View key={p.id} style={rowStyle}>
              <View style={{ flex: 1 }}>
                <Text style={rowTitle}>{p.mode}</Text>
                <Text style={rowSub}>{new Date(p.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={rowAmount}>{formatCurrency(p.amount)}</Text>
            </View>
          ))}
        </Section>

      </ScrollView>
    </View>
  );
}

function SummaryCard({ label, value, variant, footer }: { label: string; value: string; variant?: 'success' | 'warning' | 'info'; footer?: string; }) {
  let bg = 'white'; let color = theme.colors.text; let badgeBg = '#f3f4f6';
  if (variant === 'success') { badgeBg = '#dcfce7'; color: '#166534'; }
  if (variant === 'warning') { badgeBg = '#fef3c7'; color: '#92400e'; }
  if (variant === 'info') { badgeBg = '#e0f2fe'; color: '#075985'; }
  return (
    <View style={{ width: '47%', backgroundColor: bg, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
      <Text style={{ fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary, marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 18, fontWeight: '700', color }}>{value}</Text>
      {footer && <Text style={{ marginTop: 4, fontSize: 11, color: theme.colors.textSecondary }}>{footer}</Text>}
    </View>
  );
}

function ActionBtn({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean; }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ backgroundColor: primary ? '#2563eb' : 'white', paddingHorizontal: 16, flex: 1, paddingVertical: 12, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
      <Text style={{ textAlign: 'center', fontWeight: '600', color: primary ? '#fff' : theme.colors.text }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode; }) {
  return (
    <View style={{ marginBottom: 28 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 10 }}>{title}</Text>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

const rowStyle = { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 } as const;
const rowTitle = { fontSize: 14, fontWeight: '600', color: theme.colors.text } as const;
const rowSub = { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 } as const;
const rowAmount = { fontSize: 14, fontWeight: '700', color: theme.colors.text } as const;

function EmptyLine({ text }: { text: string; }) { return <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>{text}</Text>; }
