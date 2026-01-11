import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";

export default function FAQPage() {
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

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t('frequentlyAskedQuestions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>{t('faq1Question')}</AccordionTrigger>
                <AccordionContent>
                  {t('faq1Answer')}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger>{t('faq2Question')}</AccordionTrigger>
                <AccordionContent>
                  {t('faq2Answer')}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger>{t('faq3Question')}</AccordionTrigger>
                <AccordionContent>
                  {t('faq3Answer')}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4">
                <AccordionTrigger>{t('faq4Question')}</AccordionTrigger>
                <AccordionContent>
                  {t('faq4Answer')}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5">
                <AccordionTrigger>{t('faq5Question')}</AccordionTrigger>
                <AccordionContent>
                  {t('faq5Answer')}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6">
                <AccordionTrigger>{t('faq6Question')}</AccordionTrigger>
                <AccordionContent>
                  {t('faq6Answer')}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7">
                <AccordionTrigger>{t('faq7Question')}</AccordionTrigger>
                <AccordionContent>
                  {t('faq7Answer')}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8">
                <AccordionTrigger>{t('faq8Question')}</AccordionTrigger>
                <AccordionContent>
                  {t('faq8Answer')}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-9">
                <AccordionTrigger>{t('faq9Question')}</AccordionTrigger>
                <AccordionContent>
                  {t('faq9Answer')}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-10">
                <AccordionTrigger>{t('faq10Question')}</AccordionTrigger>
                <AccordionContent>
                  {t('faq10Answer')}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}