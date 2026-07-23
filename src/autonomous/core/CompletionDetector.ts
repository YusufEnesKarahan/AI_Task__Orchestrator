export class CompletionDetector {
    /**
     * Kod inceleme (Review) skoruna ve bulgularına bakarak görevin tamamlanıp tamamlanmadığını belirler.
     */
    public isCompleted(score: number, findings: string[]): boolean {
        // Skor 70'in altındaysa tamamlanmış sayılmaz
        if (score < 70) {
            return false;
        }

        // Bulgularda kritik engelleyici (blocker, crash, leak vb.) var mı denetle
        const text = findings.join(' ').toLowerCase();
        if (text.includes('vulnerability') || 
            text.includes('crash') || 
            text.includes('blocker') || 
            text.includes('security')
        ) {
            return false;
        }

        return true;
    }
}
