import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, RefreshControl,
} from 'react-native';
import { OPPORTUNITIES, CATEGORIES } from '../data/opportunities';
import OpportunityCard from '../components/OpportunityCard';

const LAST_SYNCED = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

function daysUntil(dateStr) {
  const deadline = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
}

export default function DirectoryScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [closingSoon, setClosingSoon] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState(LAST_SYNCED);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate a network sync (replace with real fetch later)
    setTimeout(() => {
      const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      setLastSynced(now);
      setRefreshing(false);
    }, 1200);
  }, []);

  const filtered = useMemo(() => {
    let items = OPPORTUNITIES;

    if (activeCategory) {
      items = items.filter((o) => o.category === activeCategory);
    }

    if (closingSoon) {
      items = items.filter((o) => {
        const d = daysUntil(o.deadline);
        return d >= 0 && d <= 30;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.organization.toLowerCase().includes(q) ||
          o.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [...items].sort((a, b) => {
      const da = new Date(a.deadline);
      const db = new Date(b.deadline);
      const aOpen = da >= today;
      const bOpen = db >= today;
      if (aOpen && !bOpen) return -1;
      if (!aOpen && bOpen) return 1;
      return da - db;
    });
  }, [searchQuery, activeCategory, closingSoon]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search fellowships, grants, tags..."
          placeholderTextColor="#aaa"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Category filter pills */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.pill, !activeCategory && !closingSoon && styles.pillActive]}
          onPress={() => { setActiveCategory(null); setClosingSoon(false); }}
        >
          <Text style={[styles.pillText, !activeCategory && !closingSoon && styles.pillTextActive]}>All</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pill, closingSoon && styles.pillUrgent]}
          onPress={() => { setClosingSoon(!closingSoon); setActiveCategory(null); }}
        >
          <Text style={[styles.pillText, closingSoon && styles.pillTextActive]}>⏰ Closing Soon</Text>
        </TouchableOpacity>

        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.pill, activeCategory === cat.id && styles.pillActive]}
            onPress={() => { setActiveCategory(activeCategory === cat.id ? null : cat.id); setClosingSoon(false); }}
          >
            <Text style={[styles.pillText, activeCategory === cat.id && styles.pillTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.resultCount}>{filtered.length} opportunities</Text>
        <Text style={styles.syncedText}>Synced {lastSynced}</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OpportunityCard
            item={item}
            onPress={() => navigation.navigate('Detail', { item })}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No matches found. Try a different search or filter.</Text>
        }
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 4 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1a3a5c"
            colors={['#1a3a5c']}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fa',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 6,
    gap: 6,
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pillActive: {
    backgroundColor: '#1a3a5c',
    borderColor: '#1a3a5c',
  },
  pillUrgent: {
    backgroundColor: '#c05c00',
    borderColor: '#c05c00',
  },
  pillText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
  pillTextActive: {
    color: '#fff',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  resultCount: {
    fontSize: 12,
    color: '#888',
  },
  syncedText: {
    fontSize: 11,
    color: '#aaa',
  },
  empty: {
    textAlign: 'center',
    color: '#aaa',
    marginTop: 60,
    fontSize: 14,
  },
});
