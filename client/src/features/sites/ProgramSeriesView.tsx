import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Calendar, ChevronDown, ChevronUp, Image, Video, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSiteContext, notifyParent, type MosaicMoment } from "./SiteContext";

function MomentCard({ moment, isActive, onClick }: {
  moment: MosaicMoment;
  isActive: boolean;
  onClick: () => void;
}) {
  const ContentIcon = moment.contentType === 'video' ? Video
    : moment.contentType === 'image' ? Image
    : FileText;

  return (
    <Card
      className={`overflow-hidden cursor-pointer hover-elevate ${isActive ? 'ring-2 ring-primary' : ''}`}
      onClick={onClick}
      data-testid={`card-moment-day-${moment.day}`}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
          <span className="text-sm font-bold text-primary">{moment.day}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate">{moment.title}</h4>
          {moment.description && (
            <p className="text-xs text-muted-foreground truncate">{moment.description}</p>
          )}
        </div>
        <ContentIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </CardContent>
    </Card>
  );
}

function MomentDetail({ moment }: { moment: MosaicMoment }) {
  return (
    <Card className="overflow-hidden" data-testid={`detail-moment-day-${moment.day}`}>
      {moment.imageUrl && (
        <div className="aspect-video bg-muted">
          <img src={moment.imageUrl} alt={moment.title} className="w-full h-full object-cover" />
        </div>
      )}
      {moment.videoUrl && (
        <div className="aspect-video bg-black">
          <video src={moment.videoUrl} controls className="w-full h-full" />
        </div>
      )}
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Day {moment.day}</Badge>
          <h3 className="font-semibold">{moment.title}</h3>
        </div>
        {moment.description && (
          <p className="text-sm text-muted-foreground">{moment.description}</p>
        )}
        {moment.bodyText && (
          <div className="text-sm leading-relaxed whitespace-pre-wrap border-t pt-3 mt-3">
            {moment.bodyText}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ProgramSeriesView() {
  const { session } = useSiteContext();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showTimeline, setShowTimeline] = useState(true);

  if (!session || !session.mosaic) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Mosaic not found</p>
      </div>
    );
  }

  const { mosaic, moments, display } = session;
  const selectedMoment = moments.find(m => m.day === selectedDay);

  const handleStart = () => {
    if (moments.length > 0) {
      setSelectedDay(moments[0].day);
      notifyParent('mosaic_started', { mosaicId: mosaic.mosaicId });
    }
  };

  return (
    <div data-testid="mosaic-series-view">
      <div className="mb-4">
        {display.entityLogoUrl && (
          <div className="flex items-center gap-3 mb-3">
            <img
              src={display.entityLogoUrl}
              alt={display.entityName || 'Store'}
              className="w-8 h-8 rounded-full object-cover"
            />
            <span className="text-sm text-muted-foreground">{display.entityName}</span>
          </div>
        )}

        {mosaic.coverImageUrl && !selectedMoment && (
          <div className="aspect-video rounded-md overflow-hidden mb-4 bg-muted">
            <img src={mosaic.coverImageUrl} alt={mosaic.title} className="w-full h-full object-cover" />
          </div>
        )}

        <h2 className="text-xl font-bold" data-testid="text-mosaic-title">{mosaic.title}</h2>
        {mosaic.description && (
          <p className="text-sm text-muted-foreground mt-1">{mosaic.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge variant="secondary">
            <Calendar className="w-3 h-3 mr-1" />
            {mosaic.totalDays} days
          </Badge>
          <Badge variant="outline">{mosaic.scheduleType === 'day-sequence' ? 'Daily Sequence' : mosaic.scheduleType}</Badge>
        </div>
      </div>

      {!selectedMoment && (
        <Button onClick={handleStart} className="w-full mb-4" data-testid="button-start-mosaic">
          <Play className="w-4 h-4 mr-2" />
          Start Series
        </Button>
      )}

      {selectedMoment && (
        <div className="mb-4">
          <MomentDetail moment={selectedMoment} />
          <div className="flex gap-2 mt-3">
            {selectedDay && selectedDay > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setSelectedDay(selectedDay - 1)}
                data-testid="button-prev-day"
              >
                Previous Day
              </Button>
            )}
            {selectedDay && selectedDay < mosaic.totalDays && (
              <Button
                size="sm"
                className="flex-1"
                onClick={() => setSelectedDay(selectedDay + 1)}
                data-testid="button-next-day"
              >
                Next Day
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTimeline(!showTimeline)}
          className="w-full flex items-center justify-between"
          data-testid="button-toggle-timeline"
        >
          <span>Timeline ({moments.length} days)</span>
          {showTimeline ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
        {showTimeline && (
          <div className="space-y-2 mt-2">
            {moments.map((moment) => (
              <MomentCard
                key={moment.day}
                moment={moment}
                isActive={moment.day === selectedDay}
                onClick={() => setSelectedDay(moment.day)}
              />
            ))}
          </div>
        )}
      </div>

      {display.returnUrl && (
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              notifyParent('navigate', { returnUrl: display.returnUrl });
              window.open(display.returnUrl!, '_blank');
            }}
            data-testid="button-return"
          >
            Return to {display.entityName || 'site'}
          </Button>
        </div>
      )}
    </div>
  );
}
