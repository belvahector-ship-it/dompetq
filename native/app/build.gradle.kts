import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

/* Kunci penandatanganan dibaca dari keystore.properties yang sengaja
   tidak ikut ter-commit. Kalau tidak ada, build release tetap jalan
   tapi hasilnya belum ditandatangani dan tidak bisa dipasang. */
val berkasKunci = rootProject.file("keystore.properties")
val kunci = Properties().apply {
    if (berkasKunci.exists()) berkasKunci.inputStream().use { load(it) }
}

android {
    namespace = "id.my.ibstudio.dompetq"
    compileSdk = 35

    defaultConfig {
        /* Sengaja beda dari APK Capacitor (id.my.ibstudio.dompetq) supaya
           keduanya bisa terpasang berdampingan untuk dibandingkan.
           "native" tidak dipakai karena itu kata kunci Java. */
        applicationId = "id.my.ibstudio.dompetq.asli"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        create("rilis") {
            if (berkasKunci.exists()) {
                storeFile = rootProject.file(kunci.getProperty("storeFile"))
                storePassword = kunci.getProperty("storePassword")
                keyAlias = kunci.getProperty("keyAlias")
                keyPassword = kunci.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            if (berkasKunci.exists()) signingConfig = signingConfigs.getByName("rilis")
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    buildFeatures { compose = true }
}

dependencies {
    val room = "2.6.1"

    implementation(platform("androidx.compose:compose-bom:2024.10.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.4")
    implementation("androidx.core:core-ktx:1.15.0")

    /* AuthorizationClient: meminta scope Drive/Sheets lalu menukarnya
       jadi access token. Aplikasi Android dikenali Google lewat package
       + SHA-1, jadi tidak ada client ID yang perlu ditanam di kode. */
    implementation("com.google.android.gms:play-services-auth:21.2.0")

    implementation("androidx.room:room-runtime:$room")
    implementation("androidx.room:room-ktx:$room")
    ksp("androidx.room:room-compiler:$room")

    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation("androidx.compose.ui:ui-tooling-preview")

    testImplementation("junit:junit:4.13.2")
}
