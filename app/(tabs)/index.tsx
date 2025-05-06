import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// Reusable PriceInput component
const PriceInput = ({ label, value, onChangeText, placeholder, error, accessibilityLabel, keyboardType = "numeric" }) => {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        keyboardType={keyboardType}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        accessible={true}
        accessibilityLabel={accessibilityLabel || label}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

// Reusable ExpandableSection component
const ExpandableSection = ({ title, isExpanded, onToggle, children, animationValue }) => {
  const rotateIcon = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={onToggle}
        accessibilityLabel={`${title} section, ${isExpanded ? 'expanded' : 'collapsed'}`}
        accessibilityRole="button"
      >
        <Text style={styles.sectionHeaderText}>{title}</Text>
        <Animated.View style={{ transform: [{ rotate: rotateIcon }] }}>
          <MaterialIcons name="keyboard-arrow-down" size={24} color="#555" />
        </Animated.View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.card}>
          {children}
        </View>
      )}
    </>
  );
};

// Utility functions
const roundToTwoDecimals = (value) => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

// Currency configuration
const CURRENCIES = {
  USD: { symbol: '$', code: 'USD' },
  EUR: { symbol: '€', code: 'EUR' },
  GBP: { symbol: '£', code: 'GBP' },
  JPY: { symbol: '¥', code: 'JPY' },
  CNY: { symbol: '¥', code: 'CNY' },
  CAD: { symbol: 'CA$', code: 'CAD' },
  AUD: { symbol: 'A$', code: 'AUD' },
};

// Main component
const PriceCalculator = () => {
  // Consolidated form state
  const [form, setForm] = useState({
    originalPrice: '',
    discountRate: '',
    shippingFee: '',
    useCoupon: false,
    couponValue: '',
    buyX: '',
    getY: '',
    itemPrice: '',
    quantity: '1',
    spendAmount: '',
    saveAmount: '',
    taxRate: '',
  });

  // UI state
  const [expandedSection, setExpandedSection] = useState(null);
  const [animations, setAnimations] = useState({
    coupon: new Animated.Value(0),
    buyX: new Animated.Value(0),
    spend: new Animated.Value(0),
    tax: new Animated.Value(0),
  });
  const [errors, setErrors] = useState({});
  const [currency, setCurrency] = useState('USD');
  const [isCalculating, setIsCalculating] = useState(false);
  const [history, setHistory] = useState([]);

  // Results state
  const [calculationResults, setCalculationResults] = useState({
    finalPrice: null,
    totalSavings: null,
    breakdown: {
      basePrice: 0,
      discountAmount: 0,
      couponAmount: 0,
      promotionAmount: 0,
      spendSaveAmount: 0,
      shippingFee: 0,
      taxAmount: 0,
    },
  });

  // Handle form input changes
  const handleInputChange = useCallback((field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear errors for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  // Toggle expandable sections
  const toggleSection = useCallback((section) => {
    const newExpandedSection = expandedSection === section ? null : section;
    setExpandedSection(newExpandedSection);

    Animated.timing(animations[section], {
      toValue: newExpandedSection === section ? 1 : 0,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
  }, [expandedSection, animations]);

  // Form validation
  const validateInputs = useCallback(() => {
    const newErrors = {};
    const {
      originalPrice, discountRate, shippingFee,
      useCoupon, couponValue, buyX, getY,
      itemPrice, spendAmount, saveAmount, taxRate
    } = form;

    // Required field validation
    if (!originalPrice || isNaN(originalPrice) || parseFloat(originalPrice) <= 0) {
      newErrors.originalPrice = 'Please enter a valid positive price';
    }

    // Optional field validation
    if (discountRate && (isNaN(discountRate) || parseFloat(discountRate) < 0 || parseFloat(discountRate) >= 100)) {
      newErrors.discountRate = 'Discount must be between 0-99%';
    }

    if (shippingFee && (isNaN(shippingFee) || parseFloat(shippingFee) < 0)) {
      newErrors.shippingFee = 'Shipping fee cannot be negative';
    }

    if (taxRate && (isNaN(taxRate) || parseFloat(taxRate) < 0)) {
      newErrors.taxRate = 'Tax rate cannot be negative';
    }

    // Coupon validation
    if (useCoupon && (!couponValue || isNaN(couponValue) || parseFloat(couponValue) <= 0)) {
      newErrors.couponValue = 'Please enter a valid coupon value';
    }

    // Buy X Get Y validation
    if ((buyX || getY) && (!buyX || !getY || isNaN(buyX) || isNaN(getY) ||
        parseFloat(buyX) <= 0 || parseFloat(getY) <= 0)) {
      newErrors.buyX = 'Both "Buy X" and "Get Y" must be positive numbers';
      newErrors.getY = 'Both "Buy X" and "Get Y" must be positive numbers';
    }

    if ((buyX || getY) && (!itemPrice || isNaN(itemPrice) || parseFloat(itemPrice) <= 0)) {
      newErrors.itemPrice = 'Please enter a valid item price';
    }

    // Spend & Save validation
    if ((spendAmount || saveAmount) && (!spendAmount || !saveAmount ||
        isNaN(spendAmount) || isNaN(saveAmount) ||
        parseFloat(spendAmount) <= 0 || parseFloat(saveAmount) <= 0)) {
      newErrors.spendAmount = 'Both "Spend" and "Save" amounts must be positive numbers';
      newErrors.saveAmount = 'Both "Spend" and "Save" amounts must be positive numbers';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  // Calculate final price with all discounts applied
  const calculateFinalPrice = useCallback(() => {
    if (!validateInputs()) {
      return;
    }

    setIsCalculating(true);

    // Parse all inputs
    const basePrice = parseFloat(form.originalPrice);
    const shipping = form.shippingFee ? parseFloat(form.shippingFee) : 0;
    const taxRate = form.taxRate ? parseFloat(form.taxRate) : 0;

    let runningTotal = basePrice;
    const breakdown = {
      basePrice,
      discountAmount: 0,
      couponAmount: 0,
      promotionAmount: 0,
      spendSaveAmount: 0,
      shippingFee: shipping,
      taxAmount: 0,
    };

    // 1. Apply percentage discount first
    if (form.discountRate && parseFloat(form.discountRate) > 0) {
      const discountAmount = roundToTwoDecimals(runningTotal * (parseFloat(form.discountRate) / 100));
      runningTotal -= discountAmount;
      breakdown.discountAmount = discountAmount;
    }

    // 2. Apply Buy X Get Y (correctly handling quantity)
    if (form.buyX && form.getY && form.itemPrice &&
        parseFloat(form.buyX) > 0 && parseFloat(form.getY) > 0 && parseFloat(form.itemPrice) > 0) {

      const singleItemPrice = parseFloat(form.itemPrice);
      const quantity = Math.ceil(basePrice / singleItemPrice);

      if (quantity > 0) {
        const freeItemsCount = Math.floor(quantity / parseFloat(form.buyX)) * parseFloat(form.getY);
        const freeItemsValue = roundToTwoDecimals(Math.min(runningTotal, freeItemsCount * singleItemPrice));
        runningTotal -= freeItemsValue;
        breakdown.promotionAmount = freeItemsValue;
      }
    }

    // 3. Apply fixed coupon
    if (form.useCoupon && form.couponValue && parseFloat(form.couponValue) > 0) {
      const couponAmount = Math.min(runningTotal, parseFloat(form.couponValue));
      runningTotal -= couponAmount;
      breakdown.couponAmount = couponAmount;
    }

    // 4. Apply spend & save
    if (form.spendAmount && form.saveAmount &&
        parseFloat(form.spendAmount) > 0 && parseFloat(form.saveAmount) > 0 &&
        basePrice >= parseFloat(form.spendAmount)) {

      const saveAmount = Math.min(runningTotal, parseFloat(form.saveAmount));
      runningTotal -= saveAmount;
      breakdown.spendSaveAmount = saveAmount;
    }

    // 5. Add shipping
    runningTotal += shipping;

    // 6. Apply tax if specified
    if (taxRate > 0) {
      const taxAmount = roundToTwoDecimals(runningTotal * (taxRate / 100));
      runningTotal += taxAmount;
      breakdown.taxAmount = taxAmount;
    }

    // 7. Ensure no negative prices
    runningTotal = Math.max(0, runningTotal);

    // Calculate total savings
    const totalSavings = roundToTwoDecimals(
      breakdown.discountAmount +
      breakdown.couponAmount +
      breakdown.promotionAmount +
      breakdown.spendSaveAmount
    );

    // Update state
    const finalPrice = roundToTwoDecimals(runningTotal);

    setCalculationResults({
      finalPrice,
      totalSavings,
      breakdown,
    });

    // Add to history
    addToHistory(finalPrice, totalSavings, breakdown);

    setIsCalculating(false);
  }, [form, validateInputs]);

  // Add calculation to history
  const addToHistory = useCallback((finalPrice, totalSavings, breakdown) => {
    const historyItem = {
      id: Date.now(),
      timestamp: new Date().toLocaleString(),
      currency: currency,
      finalPrice,
      totalSavings,
      originalPrice: form.originalPrice,
      breakdown: { ...breakdown },
    };

    setHistory(prev => [historyItem, ...prev].slice(0, 10)); // Keep only last 10 calculations
  }, [currency, form.originalPrice]);

  // Reset form
  const resetForm = useCallback(() => {
    setForm({
      originalPrice: '',
      discountRate: '',
      shippingFee: '',
      useCoupon: false,
      couponValue: '',
      buyX: '',
      getY: '',
      itemPrice: '',
      quantity: '1',
      spendAmount: '',
      saveAmount: '',
      taxRate: '',
    });
    setErrors({});
    setExpandedSection(null);
    Object.keys(animations).forEach(key => {
      animations[key].setValue(0);
    });
    // Keep calculation results visible so user can see previous calculation
  }, [animations]);

  // Currency display helper
  const formatCurrency = useCallback((amount) => {
    if (amount === null || amount === undefined) return '';
    return `${CURRENCIES[currency].symbol}${amount}`;
  }, [currency]);

  // Format breakdown for display
  const breakdownDisplay = useMemo(() => {
    if (!calculationResults.finalPrice) return null;
    const { breakdown } = calculationResults;

    return [
      { label: 'Original Price', value: formatCurrency(breakdown.basePrice) },
      breakdown.discountAmount > 0 ? { label: 'Discount', value: `-${formatCurrency(breakdown.discountAmount)}` } : null,
      breakdown.couponAmount > 0 ? { label: 'Coupon', value: `-${formatCurrency(breakdown.couponAmount)}` } : null,
      breakdown.promotionAmount > 0 ? { label: 'Buy X Get Y', value: `-${formatCurrency(breakdown.promotionAmount)}` } : null,
      breakdown.spendSaveAmount > 0 ? { label: 'Spend & Save', value: `-${formatCurrency(breakdown.spendSaveAmount)}` } : null,
      breakdown.shippingFee > 0 ? { label: 'Shipping', value: `+${formatCurrency(breakdown.shippingFee)}` } : null,
      breakdown.taxAmount > 0 ? { label: 'Tax', value: `+${formatCurrency(breakdown.taxAmount)}` } : null,
    ].filter(Boolean);
  }, [calculationResults, formatCurrency]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>💰 Price Calculator</Text>

          {/* Currency Selector */}
          <View style={styles.currencySelector}>
            <Text style={styles.label}>Currency:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {Object.keys(CURRENCIES).map((curr) => (
                <TouchableOpacity
                  key={curr}
                  style={[
                    styles.currencyButton,
                    currency === curr && styles.currencyButtonActive
                  ]}
                  onPress={() => setCurrency(curr)}
                  accessibilityLabel={`Select ${curr} currency`}
                  accessibilityState={{ selected: currency === curr }}
                >
                  <Text style={[
                    styles.currencyButtonText,
                    currency === curr && styles.currencyButtonTextActive
                  ]}>
                    {CURRENCIES[curr].symbol} {curr}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Basic Price Information */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Basic Price Information</Text>

            <PriceInput
              label={`Original Price (${CURRENCIES[currency].symbol})`}
              value={form.originalPrice}
              onChangeText={(value) => handleInputChange('originalPrice', value)}
              placeholder="e.g. 100.00"
              error={errors.originalPrice}
              accessibilityLabel="Original price in dollars"
            />

            <PriceInput
              label="Discount Rate (%)"
              value={form.discountRate}
              onChangeText={(value) => handleInputChange('discountRate', value)}
              placeholder="e.g. 20"
              error={errors.discountRate}
              accessibilityLabel="Discount percentage"
            />

            <PriceInput
              label={`Shipping Fee (${CURRENCIES[currency].symbol})`}
              value={form.shippingFee}
              onChangeText={(value) => handleInputChange('shippingFee', value)}
              placeholder="e.g. 5.99"
              error={errors.shippingFee}
              accessibilityLabel="Shipping fee amount"
            />
          </View>

          {/* Coupon Section */}
          <ExpandableSection
            title="Coupon Discount"
            isExpanded={expandedSection === 'coupon'}
            onToggle={() => toggleSection('coupon')}
            animationValue={animations.coupon}
          >
            <View style={styles.switchGroup}>
              <Text style={styles.label}>Apply Coupon</Text>
              <Switch
                value={form.useCoupon}
                onValueChange={(value) => handleInputChange('useCoupon', value)}
                trackColor={{ false: "#767577", true: "#4CAF50" }}
                thumbColor={form.useCoupon ? "#fff" : "#f4f3f4"}
                accessibilityLabel="Toggle coupon application"
                accessibilityState={{ checked: form.useCoupon }}
              />
            </View>

            {form.useCoupon && (
              <PriceInput
                label={`Coupon Value (${CURRENCIES[currency].symbol})`}
                value={form.couponValue}
                onChangeText={(value) => handleInputChange('couponValue', value)}
                placeholder="e.g. 10.00"
                error={errors.couponValue}
                accessibilityLabel="Coupon value amount"
              />
            )}
          </ExpandableSection>

          {/* Buy X Get Y Section */}
          <ExpandableSection
            title="Buy X Get Y Free"
            isExpanded={expandedSection === 'buyX'}
            onToggle={() => toggleSection('buyX')}
            animationValue={animations.buyX}
          >
            <PriceInput
              label="Buy X Items"
              value={form.buyX}
              onChangeText={(value) => handleInputChange('buyX', value)}
              placeholder="e.g. 2"
              error={errors.buyX}
              accessibilityLabel="Number of items to buy"
            />

            <PriceInput
              label="Get Y Items Free"
              value={form.getY}
              onChangeText={(value) => handleInputChange('getY', value)}
              placeholder="e.g. 1"
              error={errors.getY}
              accessibilityLabel="Number of free items"
            />

            <PriceInput
              label={`Single Item Price (${CURRENCIES[currency].symbol})`}
              value={form.itemPrice}
              onChangeText={(value) => handleInputChange('itemPrice', value)}
              placeholder="e.g. 25.00"
              error={errors.itemPrice}
              accessibilityLabel="Price of a single item"
            />
          </ExpandableSection>

          {/* Spend & Save Section */}
          <ExpandableSection
            title="Spend & Save"
            isExpanded={expandedSection === 'spend'}
            onToggle={() => toggleSection('spend')}
            animationValue={animations.spend}
          >
            <PriceInput
              label={`Spend Amount (${CURRENCIES[currency].symbol})`}
              value={form.spendAmount}
              onChangeText={(value) => handleInputChange('spendAmount', value)}
              placeholder="e.g. 50.00"
              error={errors.spendAmount}
              accessibilityLabel="Minimum amount to spend"
            />

            <PriceInput
              label={`Save Amount (${CURRENCIES[currency].symbol})`}
              value={form.saveAmount}
              onChangeText={(value) => handleInputChange('saveAmount', value)}
              placeholder="e.g. 10.00"
              error={errors.saveAmount}
              accessibilityLabel="Amount saved when spending minimum"
            />
          </ExpandableSection>

          {/* Tax Section */}
          <ExpandableSection
            title="Tax Calculation"
            isExpanded={expandedSection === 'tax'}
            onToggle={() => toggleSection('tax')}
            animationValue={animations.tax}
          >
            <PriceInput
              label="Tax Rate (%)"
              value={form.taxRate}
              onChangeText={(value) => handleInputChange('taxRate', value)}
              placeholder="e.g. 8.5"
              error={errors.taxRate}
              accessibilityLabel="Tax percentage"
            />
          </ExpandableSection>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.calculateButton}
              onPress={calculateFinalPrice}
              disabled={isCalculating}
              accessibilityLabel="Calculate final price"
              accessibilityHint="Calculates the final price with all discounts applied"
            >
              <Text style={styles.calculateButtonText}>
                {isCalculating ? 'Calculating...' : 'Calculate Final Price'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetForm}
              accessibilityLabel="Reset form"
              accessibilityHint="Clears all input fields"
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          </View>

          {/* Results Display */}
          {calculationResults.finalPrice !== null && (
            <View style={[styles.resultContainer, styles.card]}>
              <Text style={styles.resultLabel}>Final Price:</Text>
              <Text style={styles.resultPrice}>
                {formatCurrency(calculationResults.finalPrice)}
              </Text>

              <Text style={styles.resultSavings}>
                You save: {formatCurrency(calculationResults.totalSavings)}
              </Text>

              {/* Price Breakdown */}
              <View style={styles.breakdownContainer}>
                <Text style={styles.breakdownTitle}>Price Breakdown:</Text>

                {breakdownDisplay.map((item, index) => (
                  <View key={index} style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{item.label}:</Text>
                    <Text
                      style={[
                        styles.breakdownValue,
                        item.value.startsWith('-') && styles.discountValue,
                        item.value.startsWith('+') && styles.additionalValue
                      ]}
                    >
                      {item.value}
                    </Text>
                  </View>
                ))}

                <View style={[styles.breakdownRow, styles.finalPriceRow]}>
                  <Text style={styles.breakdownFinalLabel}>Final Price:</Text>
                  <Text style={styles.breakdownFinalValue}>
                    {formatCurrency(calculationResults.finalPrice)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Calculation History */}
          {history.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent Calculations</Text>

              {history.map((item, index) => (
                <View key={item.id} style={styles.historyItem}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyTimestamp}>{item.timestamp}</Text>
                    <Text style={styles.historyPrice}>
                      {CURRENCIES[item.currency].symbol}{item.finalPrice}
                    </Text>
                  </View>

                  <Text style={styles.historySavings}>
                    Original: {CURRENCIES[item.currency].symbol}{item.originalPrice} /
                    Saved: {CURRENCIES[item.currency].symbol}{item.totalSavings}
                  </Text>

                  {index < history.length - 1 && <View style={styles.historySeparator} />}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 0,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    color: '#2c3e50',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#2c3e50',
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    marginBottom: 6,
    color: '#333',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#dc3545',
    backgroundColor: '#fff8f8',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 12,
    marginTop: 4,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  calculateButton: {
    backgroundColor: '#007bff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 3,
    marginRight: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resetButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2,
    elevation: 1,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  resultContainer: {
    alignItems: 'center',
    padding: 20,
  },
  resultLabel: {
    fontSize: 18,
    marginBottom: 8,
    color: '#495057',
  },
  resultPrice: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 8,
  },
  resultSavings: {
    fontSize: 18,
    marginBottom: 16,
    color: '#6c757d',
  },
  breakdownContainer: {
    width: '100%',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#495057',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212529',
  },
  discountValue: {
    color: '#28a745',
  },
  additionalValue: {
    color: '#dc3545',
  },
  finalPriceRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  breakdownFinalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  breakdownFinalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#28a745',
  },
  currencySelector: {
    marginBottom: 16,
  },
  currencyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
    marginRight: 8,
  },
  currencyButtonActive: {
    backgroundColor: '#007bff',
  },
  currencyButtonText: {
    color: '#495057',
    fontWeight: '500',
  },
  currencyButtonTextActive: {
    color: '#fff',
  },
  historyItem: {
    marginBottom: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyTimestamp: {
    fontSize: 12,
    color: '#6c757d',
  },
  historyPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#28a745',
  },
  historySavings: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 4,
  },
  historySeparator: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 8,
  }
});

export default PriceCalculator;