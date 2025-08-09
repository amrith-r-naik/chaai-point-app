import { Plus, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { theme } from '../constants/theme';

const { width } = Dimensions.get('window');

interface Category {
  name: string;
  emoji: string;
}

interface FABCategorySelectorProps {
  categories: Category[];
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
}

export const FABCategorySelector: React.FC<FABCategorySelectorProps> = ({
  categories,
  selectedCategory,
  onCategorySelect,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  const toggleExpansion = () => {
    const toValue = isExpanded ? 0 : 1;
    
    Animated.spring(animation, {
      toValue,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
    
    setIsExpanded(!isExpanded);
  };

  const handleCategorySelect = (category: string) => {
    onCategorySelect(category);
    toggleExpansion();
  };

  const fabScale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.9],
  });

  const fabRotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const selectedCategoryData = categories.find(cat => cat.name === selectedCategory);

  return (
    <View style={styles.container}>
      {/* Category Options */}
      {isExpanded && (
        <View style={styles.categoriesContainer}>
          {categories.map((category, index) => {
            const delay = index * 50;
            const categoryOpacity = animation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            });
            
            const categoryTranslateY = animation.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            });

            return (
              <Animated.View
                key={category.name}
                style={[
                  styles.categoryItem,
                  {
                    opacity: categoryOpacity,
                    transform: [{ translateY: categoryTranslateY }],
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={() => handleCategorySelect(category.name)}
                  style={[
                    styles.categoryButton,
                    selectedCategory === category.name && styles.selectedCategoryButton,
                  ]}
                >
                  <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === category.name && styles.selectedCategoryText,
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* FAB Button */}
      <Animated.View
        style={[
          styles.fab,
          {
            transform: [{ scale: fabScale }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.fabButton}
          onPress={toggleExpansion}
          activeOpacity={0.8}
        >
          {!isExpanded && selectedCategoryData ? (
            <View style={styles.fabContent}>
              <Text style={styles.fabEmoji}>{selectedCategoryData.emoji}</Text>
              <Text style={styles.fabText}>{selectedCategoryData.name}</Text>
            </View>
          ) : (
            <Animated.View
              style={{
                transform: [{ rotate: fabRotation }],
              }}
            >
              {isExpanded ? (
                <X size={24} color="white" />
              ) : (
                <Plus size={24} color="white" />
              )}
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Overlay */}
      {isExpanded && (
        <TouchableOpacity
          style={styles.overlay}
          onPress={toggleExpansion}
          activeOpacity={1}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1000,
  },
  overlay: {
    position: 'absolute',
    top: -1000,
    left: -width,
    width: width * 2,
    height: 2000,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: -1,
  },
  categoriesContainer: {
    position: 'absolute',
    bottom: 80,
    right: 0,
    minWidth: 150,
  },
  categoryItem: {
    marginBottom: 12,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCategoryButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  selectedCategoryText: {
    color: 'white',
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  fabButton: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  fabText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
});
