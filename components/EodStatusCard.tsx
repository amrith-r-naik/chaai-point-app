import { computeISTBusinessDate } from '@/lib/db';
import { eodService } from '@/services/eodService';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Badge, StatChip } from './ui';

interface EodStatusCardProps {
  businessDate?: string; // defaults to today IST
  onRun?: (result: { processedKOTs: number; totalAmount: number }) => void;
  compact?: boolean;
  role?: string | null;
}

export const EodStatusCard: React.FC<EodStatusCardProps> = ({ businessDate, onRun, compact = false, role }) => {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unbilledCount, setUnbilledCount] = useState(0);
  const [unbilledAmount, setUnbilledAmount] = useState(0);
  const [status, setStatus] = useState<{ completed: boolean; processedKOTs: number; totalAmount: number } | null>(null);
  const [summaryHash, setSummaryHash] = useState<string | null>(null);

  const bDate = businessDate || computeISTBusinessDate(new Date().toISOString());
  const isAdmin = role === 'admin' || role === 'Admin';

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [count, amount, eodStatus] = await Promise.all([
        eodService.getUnbilledKotCount(bDate),
        eodService.getUnbilledKotAmount(bDate),
        eodService.getEodStatus(bDate),
      ]);
      setUnbilledCount(count);
      setUnbilledAmount(amount);
      if (eodStatus) {
        setStatus({ completed: eodStatus.success, processedKOTs: eodStatus.processedKots, totalAmount: eodStatus.totalAmount });
        setSummaryHash(eodStatus.checksum || null);
      } else {
        setStatus(null);
        setSummaryHash(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load EOD status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bDate]);

  const runEod = async () => {
    try {
      setRunning(true);
      const result = await eodService.processEndOfDay(bDate);
      if (onRun) onRun(result);
      await load();
    } catch (err: any) {
      setError(err?.message || 'EOD failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <View style={{
      backgroundColor: '#ffffff',
      borderRadius: 16,
      padding: compact ? 12 : 16,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>EOD – {bDate}</Text>
        {status?.completed ? <Badge variant="success">EOD DONE</Badge> : <Badge variant="info">PENDING</Badge>}
      </View>

      {loading ? (
        <View style={{ paddingVertical: 12 }}><ActivityIndicator /></View>
      ) : error ? (
        <Text style={{ color: '#b91c1c', marginTop: 8 }}>{error}</Text>
      ) : (
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StatChip label="Unbilled KOTs" value={unbilledCount} subtle />
            <StatChip label="Unbilled Amt" value={`₹${unbilledAmount}`} subtle />
            {status?.completed && (
              <StatChip label="Processed" value={status.processedKOTs} />
            )}
            {status?.completed && (
              <StatChip label="Credited" value={`₹${status.totalAmount}`} />
            )}
          </View>
          {summaryHash && (
            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>Checksum: {summaryHash}</Text>
          )}

          {!status?.completed && (
            <TouchableOpacity
              disabled={!isAdmin || running || unbilledCount === 0}
              onPress={runEod}
              style={{
                marginTop: 14,
                backgroundColor: (!isAdmin || unbilledCount === 0) ? '#94a3b8' : '#dc2626',
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: 'center'
              }}
              activeOpacity={0.75}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                {running ? 'Processing…' : unbilledCount === 0 ? 'Nothing to Close' : 'Run EOD'}
              </Text>
            </TouchableOpacity>
          )}

          {status?.completed && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 12, color: '#0f172a', fontWeight: '500' }}>
                Converted {status.processedKOTs} KOTs → ₹{status.totalAmount} credit
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};
