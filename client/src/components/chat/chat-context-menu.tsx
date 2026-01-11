import React from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { MoreVertical, Trash2, Ban, UserMinus, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User, Chat } from "@shared/schema";

interface ChatContextMenuProps {
  currentUser: User;
  chat: Chat & { otherUser: User };
  onChatDeleted: () => void;
  onUserBlocked: () => void;
}

export default function ChatContextMenu({
  currentUser,
  chat,
  onChatDeleted,
  onUserBlocked,
}: ChatContextMenuProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDeleteChat = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("DELETE", `/api/users/${currentUser.id}/chats/${chat.id}`);
      
      if (response.ok) {
        toast({
          title: t('success'),
          description: t('chatDeleted'),
        });
        onChatDeleted();
      } else {
        throw new Error('Failed to delete chat');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({
        title: t('error'),
        description: t('chatDeleteError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setShowDeleteDialog(false);
    }
  };

  const handleBlockUser = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", `/api/users/${currentUser.id}/block`, {
        blockedId: chat.otherUser.id
      });
      
      if (response.ok) {
        toast({
          title: t('success'),
          description: t('userBlocked', { username: chat.otherUser.username }),
        });
        onUserBlocked();
      } else {
        throw new Error('Failed to block user');
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      toast({
        title: t('error'),
        description: t('userBlockError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setShowBlockDialog(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-8 h-8 p-0 hover:bg-muted"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t('deleteChat')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setShowBlockDialog(true)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Ban className="w-4 h-4 mr-2" />
            {t('blockUser')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Chat Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteChatTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteChatDescription', { username: chat.otherUser.username })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteChat}
              disabled={isLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isLoading ? t('deleting') : t('deleteChat')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block User Dialog */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('blockUserTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('blockUserDescription', { username: chat.otherUser.username })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBlockUser}
              disabled={isLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isLoading ? t('blocking') : t('blockUser')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}