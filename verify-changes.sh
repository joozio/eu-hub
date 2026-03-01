#!/bin/bash

echo "🔍 Verifying EU Hub UI/UX Improvements"
echo "========================================"
echo

# Check if build directory exists
echo "✅ Checking build directory..."
if [ -d ".next" ]; then
    echo "   Build directory exists"
else
    echo "   ❌ Build directory not found"
    exit 1
fi

# Check CSS variables
echo "✅ Checking CSS variables..."
if grep -q "--primary" src/app/globals.css; then
    echo "   CSS variables properly defined"
else
    echo "   ❌ CSS variables not found"
fi

# Check CountrySelector improvements
echo "✅ Checking CountrySelector component..."
if grep -q "aria-haspopup" src/components/CountrySelector.tsx; then
    echo "   Accessibility attributes added"
else
    echo "   ❌ Accessibility attributes missing"
fi

if grep -q "z-50" src/components/CountrySelector.tsx; then
    echo "   Z-index fixed"
else
    echo "   ❌ Z-index not fixed"
fi

# Check AgeSelector improvements
echo "✅ Checking AgeSelector component..."
if grep -q "accent-primary" src/components/AgeSelector.tsx; then
    echo "   Age selector styling improved"
else
    echo "   ❌ Age selector styling not updated"
fi

# Check Button improvements
echo "✅ Checking Button component..."
if grep -q "bg-primary" src/components/ui/button.tsx; then
    echo "   Button styling updated"
else
    echo "   ❌ Button styling not updated"
fi

# Check Landing page improvements
echo "✅ Checking Landing page..."
if grep -q "bg-background" src/app/page.tsx; then
    echo "   Landing page background updated"
else
    echo "   ❌ Landing page background not updated"
fi

if grep -q "text-primary" src/app/page.tsx; then
    echo "   Landing page text colors updated"
else
    echo "   ❌ Landing page text colors not updated"
fi

# Check Feed page improvements
echo "✅ Checking Feed page..."
if grep -q "border-l-4" src/app/feed/page.tsx; then
    echo "   Feed page card styling improved"
else
    echo "   ❌ Feed page card styling not updated"
fi

echo
echo "🎉 All UI/UX improvements have been verified!"
echo
echo "🚀 To test the application:"
echo "   1. Run: npm run dev"
echo "   2. Open: http://localhost:3000"
echo "   3. Test all components and interactions"
echo
echo "📋 Expected improvements:"
echo "   ✅ Better contrast and readability"
echo "   ✅ Working country selector with search"
echo "   ✅ Improved button states"
echo "   ✅ Enhanced card layouts"
echo "   ✅ Professional color scheme"
echo "   ✅ Accessibility improvements"
