# Project Summary — Yapay_Zeka_Görev_Orkestratörü

*Tarama Tarihi: 14.07.2026 16:18:08*

## 1. Proje Özeti
Bu proje, **VS Code Extension** yapısında kurulmuş bir yazılımdır. Toplamda yaklaşık 18 kök bileşene ve modüle sahiptir.
Workspace hash: `6bd41a326990`

## 2. Teknolojiler
Taramada tespit edilen teknoloji yığını (Confidence skoru ile):

- **TypeScript** (Language) — Confidence: %95
- **JavaScript** (Language) — Confidence: %90
- **HTML** (Language) — Confidence: %85
- **CSS** (Language) — Confidence: %85
- **NodeJS** (Runtime) — Confidence: %100
- **NPM** (Package Manager) — Confidence: %95
- **VS Code Extension API** (Framework) — Confidence: %100

## 3. Mimari Yapı
*   **Mevcut Mimari Stil:** VS Code Extension (Webview Host) (Güven Skoru: %95)
*   **Katman Sayısı:** 3

Tanımlanan mimari katmanlar:
- **UI** (`webview-ui/**`)
- **Extension Host** (`src/**`)
- **Shared** (`src/shared/**`)

## 4. Modüller ve Servis Bağlantıları
*   **Toplam Modül Sayısı:** 6
*   **Toplam Bağımlılık Bağlantısı:** 312

## 5. Sağlık ve Kalite Raporu
*   **Architecture Score:** 79/100
*   **Maintainability (Bakım Yapılabilirlik):** 75/100
*   **Complexity (Karmaşıklık):** 86/100
*   **Documentation:** 55/100
*   **Testing:** 80/100
*   **Technical Debt (Teknik Borç Oranı):** %25

## 6. Riskler ve Eksikler
### Circular Dependency Riskleri
- Döngü: `src/shared/types/sharedTypes.ts -> src/core/types/prompt.types.ts -> src/core/types/index.ts -> src/shared/types/sharedTypes.ts`
### Mimari Katman İhlalleri
- Mimari İhlal: 'Shared' katmanı (src/shared/types/sharedTypes.ts), 'Extension Host' katmanına (src/core/types/prompt.types.ts) doğrudan bağımlı olamaz.

## 7. Güçlü Yönler
- **Modüler Dizin Yapısı:** Projedeki sorumluluklar belirli klasör rollerine ayrılmıştır.
- **Tip Güvenliği:** TypeScript desteği ile statik tip güvenliği sağlanmıştır.

## 8. Sonraki Sprint Önerileri
1.  **Birim Test Kapsamını Artırın:** Test doğrulamalarını daha sıkı hale getirin.
2.  **Büyük Dosyaları Parçalayın:** Dev boyuttaki kod dosyalarını küçük modüllere refactor edin.
