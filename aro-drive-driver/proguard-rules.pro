# ============================================
# ProGuard Rules for ARO DRIVE Driver App
# ============================================

# ---- React Native ----
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**

# ---- React Native Reanimated ----
-keep class com.swmansion.reanimated.** { *; }
-dontwarn com.swmansion.reanimated.**

# ---- React Native Gesture Handler ----
-keep class com.swmansion.gesturehandler.** { *; }
-dontwarn com.swmansion.gesturehandler.**

# ---- React Native Screens ----
-keep class com.swmansion.rnscreens.** { *; }
-dontwarn com.swmansion.rnscreens.**

# ---- React Native Maps (Google Maps) ----
-keep class com.google.android.gms.maps.** { *; }
-keep class com.google.android.gms.location.** { *; }
-keep class com.airbnb.android.react.maps.** { *; }
-dontwarn com.google.android.gms.**

# ---- Firebase ----
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# ---- Expo Modules ----
-keep class expo.modules.** { *; }
-dontwarn expo.modules.**
-keep class expo.modules.kotlin.types.** { *; }
-keep class expo.modules.kotlin.** { *; }

# ---- Expo Location ----
-keep class expo.modules.location.** { *; }

# ---- Expo Image Picker ----
-keep class expo.modules.imagepicker.** { *; }

# ---- Expo Notifications ----
-keep class expo.modules.notifications.** { *; }

# ---- OkHttp (used by Firebase & networking) ----
-keep class okhttp3.** { *; }
-dontwarn okhttp3.**
-keep class okio.** { *; }
-dontwarn okio.**

# ---- Keep annotations ----
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# ---- Keep JavaScript interfaces ----
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
}
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp *;
}

# ---- Prevent stripping of native methods ----
-keepclasseswithmembernames class * {
    native <methods>;
}

# ---- Keep enums ----
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ---- Suppress common warnings ----
-dontwarn javax.annotation.**
-dontwarn sun.misc.**
-dontwarn java.lang.invoke.**
