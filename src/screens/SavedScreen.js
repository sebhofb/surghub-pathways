import React from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { useSaved } from '../context/SavedContext';
import { OPPORTUNITIES } from '../data/opportunities';
import OpportunityCard from '../components/OpportunityCard';

export default function SavedScreen({ navigation }) {
  const { savedIds } = useSaved();
  const savedItems = OPPORTUNITIES.filter((o) => savedIds.has(o.id));

  if (savedItems.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔖</Text>
          <Text style={styles.emptyTitle}>No saved opportunities</Text>
          <Text style={styles.emptySubtitle}>
            Tap the bookmark icon on any listing to save it here for quick access.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={savedItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OpportunityCard
            item={item}
            onPress={() => navigation.navigate('SavedDetail', { item })}
          />
        )}
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 12 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fa',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    lineHeight: 20,
  },
});
