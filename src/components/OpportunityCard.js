import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSaved } from '../context/SavedContext';

const CATEGORY_COLORS = {
  fellowship: '#1a6b4a',
  scholarship: '#1a3a5c',
  grant: '#7b3a8c',
  conference: '#c05c00',
  research: '#8c3a1a',
};

function daysUntil(dateStr) {
  const deadline = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
}

function formatDeadline(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OpportunityCard({ item, onPress }) {
  const { savedIds, toggleSaved } = useSaved();
  const isSaved = savedIds.has(item.id);
  const hasDeadline = !!item.deadline;
  const days = hasDeadline ? daysUntil(item.deadline) : null;
  const categoryColor = CATEGORY_COLORS[item.category] || '#444';
  const isUrgent = hasDeadline && days >= 0 && days <= 14;
  const isPast = hasDeadline && days < 0;

  return (
    <TouchableOpacity
      style={[styles.card, item.isSponsored && styles.sponsoredCard]}
      onPress={() => onPress(item)}
      activeOpacity={0.85}
    >
      {item.isSponsored && (
        <View style={styles.sponsoredBanner}>
          <Text style={styles.sponsoredBannerText}>⭐ SPONSORED</Text>
        </View>
      )}
      <View style={styles.header}>
        <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
          <Text style={styles.categoryText}>{item.category.toUpperCase()}</Text>
        </View>
        {item.isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newText}>NEW</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.bookmarkBtn}
          onPress={() => toggleSaved(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={isSaved ? '#1a3a5c' : '#bbb'}
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.org}>{item.organization}</Text>
      <Text style={styles.location}>📍 {item.location}</Text>

      <View style={styles.footer}>
        <Text style={[
          styles.deadline,
          isUrgent && styles.urgentDeadline,
          isPast && styles.pastDeadline,
          !hasDeadline && styles.ongoingDeadline,
        ]}>
          {!hasDeadline
            ? '🔄 Ongoing / Rolling admissions'
            : isPast
              ? 'Closed'
              : `⏰ Deadline: ${formatDeadline(item.deadline)}${isUrgent ? `  (${days}d left!)` : ''}`
          }
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  sponsoredCard: {
    borderWidth: 1.5,
    borderColor: '#c9a84c',
    backgroundColor: '#fffdf5',
    shadowColor: '#c9a84c',
    shadowOpacity: 0.15,
    elevation: 5,
  },
  sponsoredBanner: {
    backgroundColor: '#c9a84c',
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 12,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  sponsoredBannerText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  categoryBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  newBadge: {
    backgroundColor: '#e8f5e9',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  newText: {
    color: '#2e7d32',
    fontSize: 10,
    fontWeight: '700',
  },
  bookmarkBtn: {
    marginLeft: 'auto',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 4,
    lineHeight: 21,
  },
  org: {
    fontSize: 13,
    color: '#555',
    marginBottom: 2,
  },
  location: {
    fontSize: 12,
    color: '#777',
    marginBottom: 10,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  deadline: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
  urgentDeadline: {
    color: '#c05c00',
    fontWeight: '700',
  },
  pastDeadline: {
    color: '#aaa',
  },
  ongoingDeadline: {
    color: '#1a6b4a',
    fontStyle: 'italic',
  },
});
