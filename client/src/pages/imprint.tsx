import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";

export default function ImprintPage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('back')}</span>
          </Button>
        </div>

        {/* Impressum */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t('imprint')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">{t('operatorInfo')}</h3>
              <p className="text-muted-foreground">
                Tufan Dönmezyürek<br />
                Whispergram<br />
                {t('secureMessaging')}<br />
                {t('anonymousService')}
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">{t('contact')}</h3>
              <p className="text-muted-foreground">
                {t('contactInfo')}: contactwhispergram@gmail.com<br />
                {t('technicalSupport')}: contactwhispergram@gmail.com
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">{t('dataProtection')}</h3>
              <p className="text-muted-foreground">
                {t('dataProtectionInfo')}
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">{t('legalNotice')}</h3>
              <p className="text-muted-foreground">
                {t('legalNoticeText')}
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">{t('encryption')}</h3>
              <p className="text-muted-foreground">
                {t('encryptionInfo')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Server Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t('serverInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">{t('howItWorks')}</h3>
              <p className="text-muted-foreground mb-3">
                {t('serverExplanation')}
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>{t('serverPoint1')}</li>
                <li>{t('serverPoint2')}</li>
                <li>{t('serverPoint3')}</li>
                <li>{t('serverPoint4')}</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">{t('infrastructure')}</h3>
              <p className="text-muted-foreground">
                {t('infrastructureInfo')}
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">{t('security')}</h3>
              <p className="text-muted-foreground">
                {t('securityInfo')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}