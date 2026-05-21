export type BuyerNotificationType =
  | 'rfq_assigned' // Admin assigned RFQ to supplier
  | 'rfq_quoted' // Supplier submitted quote
  | 'rfq_status_change' // RFQ status updated by admin
  | 'order_stage_change' // Order moved to new pipeline stage
  | 'order_shipped' // Shipment created
  | 'milestone_added' // New milestone on order
  | 'sample_processed' // Sample request processed
  | 'quote_received' // New landed-cost quote from admin
  | 'profile_verified' // Admin verified buyer
  | 'profile_rejected' // Admin rejected verification
  | 'qc_report_ready' // QC inspection report available
  | 'document_ready' // Export document available
  | 'message_received' // New message
  | 'admin_announcement'; // Admin broadcast

export interface BuyerNotification {
  id: number;
  targetDashboard: 'buyer';
  orderId?: string;
  type: BuyerNotificationType;
  title: string;
  message?: string;
  read: boolean;
  actionUrl?: string;
  createdAt?: string;
}
