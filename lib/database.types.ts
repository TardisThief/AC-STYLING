
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_notifications": {
                  Row: {
                    "action_taken": string | null,"created_at": string | null,"id": string,"message": string | null,"metadata": Json | null,"reference_id": string | null,"status": string | null,"title": string,"type": string,"user_id": string | null
                  }
                  Insert: {
                    "action_taken"?: string | null,"created_at"?: string | null,"id"?: string,"message"?: string | null,"metadata"?: Json | null,"reference_id"?: string | null,"status"?: string | null,"title": string,"type": string,"user_id"?: string | null
                  }
                  Update: {
                    "action_taken"?: string | null,"created_at"?: string | null,"id"?: string,"message"?: string | null,"metadata"?: Json | null,"reference_id"?: string | null,"status"?: string | null,"title"?: string,"type"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"boutique_clicks": {
                  Row: {
                    "clicked_at": string,"id": string,"item_id": string,"locale": string,"user_id": string | null
                  }
                  Insert: {
                    "clicked_at"?: string,"id"?: string,"item_id": string,"locale"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "clicked_at"?: string,"id"?: string,"item_id"?: string,"locale"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "boutique_clicks_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "boutique_items"
      referencedColumns: ["id"]
    }
                  ]
                },"boutique_collection_items": {
                  Row: {
                    "collection_id": string,"id": string,"item_id": string,"position": number
                  }
                  Insert: {
                    "collection_id": string,"id"?: string,"item_id": string,"position"?: number
                  }
                  Update: {
                    "collection_id"?: string,"id"?: string,"item_id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "boutique_collection_items_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "boutique_collections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "boutique_collection_items_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "boutique_items"
      referencedColumns: ["id"]
    }
                  ]
                },"boutique_collections": {
                  Row: {
                    "active": boolean,"cover_image_url": string | null,"created_at": string,"description": string | null,"description_es": string | null,"id": string,"order_index": number,"title": string,"title_es": string | null,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"cover_image_url"?: string | null,"created_at"?: string,"description"?: string | null,"description_es"?: string | null,"id"?: string,"order_index"?: number,"title": string,"title_es"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"cover_image_url"?: string | null,"created_at"?: string,"description"?: string | null,"description_es"?: string | null,"id"?: string,"order_index"?: number,"title"?: string,"title_es"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"boutique_items": {
                  Row: {
                    "active": boolean | null,"affiliate_url_es": string | null,"affiliate_url_usa": string | null,"brand_id": string | null,"category": string | null,"created_at": string | null,"curator_note": string | null,"curator_note_es": string | null,"id": string,"image_url": string,"name": string,"order_index": number | null,"updated_at": string | null
                  }
                  Insert: {
                    "active"?: boolean | null,"affiliate_url_es"?: string | null,"affiliate_url_usa"?: string | null,"brand_id"?: string | null,"category"?: string | null,"created_at"?: string | null,"curator_note"?: string | null,"curator_note_es"?: string | null,"id"?: string,"image_url": string,"name": string,"order_index"?: number | null,"updated_at"?: string | null
                  }
                  Update: {
                    "active"?: boolean | null,"affiliate_url_es"?: string | null,"affiliate_url_usa"?: string | null,"brand_id"?: string | null,"category"?: string | null,"created_at"?: string | null,"curator_note"?: string | null,"curator_note_es"?: string | null,"id"?: string,"image_url"?: string,"name"?: string,"order_index"?: number | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "boutique_items_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "partner_brands"
      referencedColumns: ["id"]
    }
                  ]
                },"boutique_saves": {
                  Row: {
                    "id": string,"item_id": string,"saved_at": string,"user_id": string
                  }
                  Insert: {
                    "id"?: string,"item_id": string,"saved_at"?: string,"user_id": string
                  }
                  Update: {
                    "id"?: string,"item_id"?: string,"saved_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "boutique_saves_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "boutique_items"
      referencedColumns: ["id"]
    }
                  ]
                },"chapters": {
                  Row: {
                    "available_at": string | null,"category": string | null,"created_at": string | null,"description": string | null,"description_es": string | null,"id": string,"is_published": boolean,"is_standalone": boolean | null,"lab_questions": Json | null,"masterclass_id": string | null,"order_index": number,"price_id": string | null,"resource_urls": Json | null,"slug": string,"stripe_product_id": string | null,"subtitle": string | null,"subtitle_es": string | null,"takeaways": Json | null,"takeaways_es": Json | null,"thumbnail_url": string | null,"title": string,"title_es": string | null,"updated_at": string | null,"video_id": string,"video_id_es": string | null
                  }
                  Insert: {
                    "available_at"?: string | null,"category"?: string | null,"created_at"?: string | null,"description"?: string | null,"description_es"?: string | null,"id"?: string,"is_published"?: boolean,"is_standalone"?: boolean | null,"lab_questions"?: Json | null,"masterclass_id"?: string | null,"order_index"?: number,"price_id"?: string | null,"resource_urls"?: Json | null,"slug": string,"stripe_product_id"?: string | null,"subtitle"?: string | null,"subtitle_es"?: string | null,"takeaways"?: Json | null,"takeaways_es"?: Json | null,"thumbnail_url"?: string | null,"title": string,"title_es"?: string | null,"updated_at"?: string | null,"video_id": string,"video_id_es"?: string | null
                  }
                  Update: {
                    "available_at"?: string | null,"category"?: string | null,"created_at"?: string | null,"description"?: string | null,"description_es"?: string | null,"id"?: string,"is_published"?: boolean,"is_standalone"?: boolean | null,"lab_questions"?: Json | null,"masterclass_id"?: string | null,"order_index"?: number,"price_id"?: string | null,"resource_urls"?: Json | null,"slug"?: string,"stripe_product_id"?: string | null,"subtitle"?: string | null,"subtitle_es"?: string | null,"takeaways"?: Json | null,"takeaways_es"?: Json | null,"thumbnail_url"?: string | null,"title"?: string,"title_es"?: string | null,"updated_at"?: string | null,"video_id"?: string,"video_id_es"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "chapters_masterclass_id_fkey"
      columns: ["masterclass_id"]
isOneToOne: false
      referencedRelation: "masterclasses"
      referencedColumns: ["id"]
    }
                  ]
                },"essence_responses": {
                  Row: {
                    "answer_value": NonNullable<Json>,"chapter_id": string | null,"chapter_slug": string | null,"context_metadata": Json | null,"created_at": string | null,"id": string,"masterclass_id": string | null,"question_key": string,"updated_at": string | null,"user_id": string
                  }
                  Insert: {
                    "answer_value"?: NonNullable<Json>,"chapter_id"?: string | null,"chapter_slug"?: string | null,"context_metadata"?: Json | null,"created_at"?: string | null,"id"?: string,"masterclass_id"?: string | null,"question_key": string,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "answer_value"?: NonNullable<Json>,"chapter_id"?: string | null,"chapter_slug"?: string | null,"context_metadata"?: Json | null,"created_at"?: string | null,"id"?: string,"masterclass_id"?: string | null,"question_key"?: string,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "essence_responses_chapter_id_fkey"
      columns: ["chapter_id"]
isOneToOne: false
      referencedRelation: "chapters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "essence_responses_masterclass_id_fkey"
      columns: ["masterclass_id"]
isOneToOne: false
      referencedRelation: "masterclasses"
      referencedColumns: ["id"]
    }
                  ]
                },"fulfillments": {
                  Row: {
                    "amount_total": number | null,"attempts": number,"completed_at": string | null,"created_at": string,"currency": string | null,"id": string,"last_error": string | null,"receipt_sent_at": string | null,"status": string,"stripe_event_id": string,"stripe_line_item_id": string,"stripe_product_id": string,"stripe_session_id": string,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "amount_total"?: number | null,"attempts"?: number,"completed_at"?: string | null,"created_at"?: string,"currency"?: string | null,"id"?: string,"last_error"?: string | null,"receipt_sent_at"?: string | null,"status"?: string,"stripe_event_id": string,"stripe_line_item_id": string,"stripe_product_id": string,"stripe_session_id": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "amount_total"?: number | null,"attempts"?: number,"completed_at"?: string | null,"created_at"?: string,"currency"?: string | null,"id"?: string,"last_error"?: string | null,"receipt_sent_at"?: string | null,"status"?: string,"stripe_event_id"?: string,"stripe_line_item_id"?: string,"stripe_product_id"?: string,"stripe_session_id"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"lookbooks": {
                  Row: {
                    "collection_name": string | null,"created_at": string | null,"id": string,"lookbook_items": Json | null,"metadata": Json | null,"status": string | null,"thumbnail_url": string | null,"title": string,"updated_at": string | null,"wardrobe_id": string
                  }
                  Insert: {
                    "collection_name"?: string | null,"created_at"?: string | null,"id"?: string,"lookbook_items"?: Json | null,"metadata"?: Json | null,"status"?: string | null,"thumbnail_url"?: string | null,"title": string,"updated_at"?: string | null,"wardrobe_id": string
                  }
                  Update: {
                    "collection_name"?: string | null,"created_at"?: string | null,"id"?: string,"lookbook_items"?: Json | null,"metadata"?: Json | null,"status"?: string | null,"thumbnail_url"?: string | null,"title"?: string,"updated_at"?: string | null,"wardrobe_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lookbooks_wardrobe_id_fkey"
      columns: ["wardrobe_id"]
isOneToOne: false
      referencedRelation: "wardrobes"
      referencedColumns: ["id"]
    }
                  ]
                },"masterclasses": {
                  Row: {
                    "available_at": string | null,"created_at": string,"description": string | null,"description_es": string | null,"id": string,"is_published": boolean,"order_index": number | null,"price_display": string | null,"price_id": string | null,"resource_urls": NonNullable<Json>,"runtime_minutes": number | null,"stripe_product_id": string | null,"subtitle": string | null,"subtitle_es": string | null,"takeaways_es": Json | null,"thumbnail_url": string | null,"title": string,"title_es": string | null,"updated_at": string,"video_url": string | null
                  }
                  Insert: {
                    "available_at"?: string | null,"created_at"?: string,"description"?: string | null,"description_es"?: string | null,"id"?: string,"is_published"?: boolean,"order_index"?: number | null,"price_display"?: string | null,"price_id"?: string | null,"resource_urls"?: NonNullable<Json>,"runtime_minutes"?: number | null,"stripe_product_id"?: string | null,"subtitle"?: string | null,"subtitle_es"?: string | null,"takeaways_es"?: Json | null,"thumbnail_url"?: string | null,"title": string,"title_es"?: string | null,"updated_at"?: string,"video_url"?: string | null
                  }
                  Update: {
                    "available_at"?: string | null,"created_at"?: string,"description"?: string | null,"description_es"?: string | null,"id"?: string,"is_published"?: boolean,"order_index"?: number | null,"price_display"?: string | null,"price_id"?: string | null,"resource_urls"?: NonNullable<Json>,"runtime_minutes"?: number | null,"stripe_product_id"?: string | null,"subtitle"?: string | null,"subtitle_es"?: string | null,"takeaways_es"?: Json | null,"thumbnail_url"?: string | null,"title"?: string,"title_es"?: string | null,"updated_at"?: string,"video_url"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"offers": {
                  Row: {
                    "active": boolean | null,"created_at": string | null,"description": string | null,"description_es": string | null,"id": string,"price_display": string | null,"price_id": string | null,"slug": string,"stripe_product_id": string | null,"title": string,"title_es": string | null,"updated_at": string | null
                  }
                  Insert: {
                    "active"?: boolean | null,"created_at"?: string | null,"description"?: string | null,"description_es"?: string | null,"id"?: string,"price_display"?: string | null,"price_id"?: string | null,"slug": string,"stripe_product_id"?: string | null,"title": string,"title_es"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "active"?: boolean | null,"created_at"?: string | null,"description"?: string | null,"description_es"?: string | null,"id"?: string,"price_display"?: string | null,"price_id"?: string | null,"slug"?: string,"stripe_product_id"?: string | null,"title"?: string,"title_es"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"partner_brands": {
                  Row: {
                    "active": boolean | null,"commission_rate": number | null,"contact_email": string | null,"contact_name": string | null,"created_at": string | null,"id": string,"internal_notes": string | null,"logo_url": string | null,"name": string,"order_index": number | null,"partnership_status": string,"updated_at": string | null,"website_url": string | null
                  }
                  Insert: {
                    "active"?: boolean | null,"commission_rate"?: number | null,"contact_email"?: string | null,"contact_name"?: string | null,"created_at"?: string | null,"id"?: string,"internal_notes"?: string | null,"logo_url"?: string | null,"name": string,"order_index"?: number | null,"partnership_status"?: string,"updated_at"?: string | null,"website_url"?: string | null
                  }
                  Update: {
                    "active"?: boolean | null,"commission_rate"?: number | null,"contact_email"?: string | null,"contact_name"?: string | null,"created_at"?: string | null,"id"?: string,"internal_notes"?: string | null,"logo_url"?: string | null,"name"?: string,"order_index"?: number | null,"partnership_status"?: string,"updated_at"?: string | null,"website_url"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "access_expires_at": string | null,"access_renewal_count": number,"access_term_line_items": NonNullable<Json>,"active_studio_client": boolean | null,"avatar_url": string | null,"converted_at": string | null,"created_at": string | null,"email": string | null,"full_name": string | null,"has_course_pass": boolean | null,"has_full_unlock": boolean | null,"has_masterclass_pass": boolean,"id": string,"intake_token": string | null,"is_guest": boolean | null,"language_preference": string | null,"role": string | null,"status": string | null,"studio_permissions": Json | null,"style_essentials": Json | null,"updated_at": string | null,"username": string | null,"website": string | null
                  }
                  Insert: {
                    "access_expires_at"?: string | null,"access_renewal_count"?: number,"access_term_line_items"?: NonNullable<Json>,"active_studio_client"?: boolean | null,"avatar_url"?: string | null,"converted_at"?: string | null,"created_at"?: string | null,"email"?: string | null,"full_name"?: string | null,"has_course_pass"?: boolean | null,"has_full_unlock"?: boolean | null,"has_masterclass_pass"?: boolean,"id": string,"intake_token"?: string | null,"is_guest"?: boolean | null,"language_preference"?: string | null,"role"?: string | null,"status"?: string | null,"studio_permissions"?: Json | null,"style_essentials"?: Json | null,"updated_at"?: string | null,"username"?: string | null,"website"?: string | null
                  }
                  Update: {
                    "access_expires_at"?: string | null,"access_renewal_count"?: number,"access_term_line_items"?: NonNullable<Json>,"active_studio_client"?: boolean | null,"avatar_url"?: string | null,"converted_at"?: string | null,"created_at"?: string | null,"email"?: string | null,"full_name"?: string | null,"has_course_pass"?: boolean | null,"has_full_unlock"?: boolean | null,"has_masterclass_pass"?: boolean,"id"?: string,"intake_token"?: string | null,"is_guest"?: boolean | null,"language_preference"?: string | null,"role"?: string | null,"status"?: string | null,"studio_permissions"?: Json | null,"style_essentials"?: Json | null,"updated_at"?: string | null,"username"?: string | null,"website"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"purchase_claims": {
                  Row: {
                    "consumed_at": string | null,"consumed_reason": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"stripe_session_id": string,"user_id": string
                  }
                  Insert: {
                    "consumed_at"?: string | null,"consumed_reason"?: string | null,"created_at"?: string,"email": string,"expires_at": string,"id"?: string,"stripe_session_id": string,"user_id": string
                  }
                  Update: {
                    "consumed_at"?: string | null,"consumed_reason"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"stripe_session_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"purchases": {
                  Row: {
                    "amount_paid": number | null,"created_at": string | null,"currency": string | null,"id": string,"is_renewal": boolean,"product_id": string,"status": string | null,"stripe_line_item_id": string | null,"user_id": string | null
                  }
                  Insert: {
                    "amount_paid"?: number | null,"created_at"?: string | null,"currency"?: string | null,"id"?: string,"is_renewal"?: boolean,"product_id": string,"status"?: string | null,"stripe_line_item_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "amount_paid"?: number | null,"created_at"?: string | null,"currency"?: string | null,"id"?: string,"is_renewal"?: boolean,"product_id"?: string,"status"?: string | null,"stripe_line_item_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  Insert: {
                    "count"?: number,"key": string,"window_start"?: string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"services": {
                  Row: {
                    "active": boolean | null,"created_at": string | null,"description": string | null,"description_es": string | null,"id": string,"image_url": string | null,"order_index": number | null,"price_display": string | null,"price_display_es": string | null,"price_id": string | null,"recommendation_tags": (string)[] | null,"stripe_product_id": string | null,"stripe_url": string | null,"subtitle": string | null,"subtitle_es": string | null,"title": string,"title_es": string | null,"type": string | null,"unlocks_studio_access": boolean | null,"updated_at": string | null
                  }
                  Insert: {
                    "active"?: boolean | null,"created_at"?: string | null,"description"?: string | null,"description_es"?: string | null,"id"?: string,"image_url"?: string | null,"order_index"?: number | null,"price_display"?: string | null,"price_display_es"?: string | null,"price_id"?: string | null,"recommendation_tags"?: (string)[] | null,"stripe_product_id"?: string | null,"stripe_url"?: string | null,"subtitle"?: string | null,"subtitle_es"?: string | null,"title": string,"title_es"?: string | null,"type"?: string | null,"unlocks_studio_access"?: boolean | null,"updated_at"?: string | null
                  }
                  Update: {
                    "active"?: boolean | null,"created_at"?: string | null,"description"?: string | null,"description_es"?: string | null,"id"?: string,"image_url"?: string | null,"order_index"?: number | null,"price_display"?: string | null,"price_display_es"?: string | null,"price_id"?: string | null,"recommendation_tags"?: (string)[] | null,"stripe_product_id"?: string | null,"stripe_url"?: string | null,"subtitle"?: string | null,"subtitle_es"?: string | null,"title"?: string,"title_es"?: string | null,"type"?: string | null,"unlocks_studio_access"?: boolean | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"stripe_processed_events": {
                  Row: {
                    "event_id": string,"processed_at": string
                  }
                  Insert: {
                    "event_id": string,"processed_at"?: string
                  }
                  Update: {
                    "event_id"?: string,"processed_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tailor_cards": {
                  Row: {
                    "created_at": string | null,"id": string,"last_updated_by": string | null,"measurements": NonNullable<Json>,"updated_at": string | null,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"last_updated_by"?: string | null,"measurements"?: NonNullable<Json>,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"last_updated_by"?: string | null,"measurements"?: NonNullable<Json>,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tailor_cards_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"trusted_by_logos": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"logo_url": string,"name": string,"order_index": number
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"logo_url": string,"name": string,"order_index"?: number
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"logo_url"?: string,"name"?: string,"order_index"?: number
                  }
                  Relationships: [
                    
                  ]
                },"user_access_grants": {
                  Row: {
                    "chapter_id": string | null,"expires_at": string | null,"grant_type": string | null,"granted_at": string | null,"id": string,"masterclass_id": string | null,"offer_slug": string | null,"renewal_count": number,"term_line_items": NonNullable<Json>,"user_id": string
                  }
                  Insert: {
                    "chapter_id"?: string | null,"expires_at"?: string | null,"grant_type"?: string | null,"granted_at"?: string | null,"id"?: string,"masterclass_id"?: string | null,"offer_slug"?: string | null,"renewal_count"?: number,"term_line_items"?: NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "chapter_id"?: string | null,"expires_at"?: string | null,"grant_type"?: string | null,"granted_at"?: string | null,"id"?: string,"masterclass_id"?: string | null,"offer_slug"?: string | null,"renewal_count"?: number,"term_line_items"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_access_grants_chapter_id_fkey"
      columns: ["chapter_id"]
isOneToOne: false
      referencedRelation: "chapters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_access_grants_masterclass_id_fkey"
      columns: ["masterclass_id"]
isOneToOne: false
      referencedRelation: "masterclasses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_access_grants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_progress": {
                  Row: {
                    "completed_at": string | null,"content_id": string,"id": string,"user_id": string
                  }
                  Insert: {
                    "completed_at"?: string | null,"content_id": string,"id"?: string,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"content_id"?: string,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_questions": {
                  Row: {
                    "answer": string | null,"answered_at": string | null,"created_at": string | null,"id": string,"question": string,"status": string | null,"user_id": string
                  }
                  Insert: {
                    "answer"?: string | null,"answered_at"?: string | null,"created_at"?: string | null,"id"?: string,"question": string,"status"?: string | null,"user_id": string
                  }
                  Update: {
                    "answer"?: string | null,"answered_at"?: string | null,"created_at"?: string | null,"id"?: string,"question"?: string,"status"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_questions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"wardrobe_items": {
                  Row: {
                    "brand": string | null,"category": string | null,"client_note": string | null,"created_at": string | null,"id": string,"image_url": string | null,"internal_note": string | null,"is_general_library": boolean | null,"notes": string | null,"product_link_id": string | null,"status": string | null,"tags": (string)[] | null,"updated_at": string | null,"user_id": string | null,"wardrobe_id": string | null
                  }
                  Insert: {
                    "brand"?: string | null,"category"?: string | null,"client_note"?: string | null,"created_at"?: string | null,"id"?: string,"image_url"?: string | null,"internal_note"?: string | null,"is_general_library"?: boolean | null,"notes"?: string | null,"product_link_id"?: string | null,"status"?: string | null,"tags"?: (string)[] | null,"updated_at"?: string | null,"user_id"?: string | null,"wardrobe_id"?: string | null
                  }
                  Update: {
                    "brand"?: string | null,"category"?: string | null,"client_note"?: string | null,"created_at"?: string | null,"id"?: string,"image_url"?: string | null,"internal_note"?: string | null,"is_general_library"?: boolean | null,"notes"?: string | null,"product_link_id"?: string | null,"status"?: string | null,"tags"?: (string)[] | null,"updated_at"?: string | null,"user_id"?: string | null,"wardrobe_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "wardrobe_items_product_link_id_fkey"
      columns: ["product_link_id"]
isOneToOne: false
      referencedRelation: "boutique_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wardrobe_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wardrobe_items_wardrobe_id_fkey"
      columns: ["wardrobe_id"]
isOneToOne: false
      referencedRelation: "wardrobes"
      referencedColumns: ["id"]
    }
                  ]
                },"wardrobes": {
                  Row: {
                    "created_at": string | null,"id": string,"owner_id": string | null,"status": string | null,"title": string,"updated_at": string | null,"upload_token": string | null,"upload_token_expires_at": string
                  }
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"owner_id"?: string | null,"status"?: string | null,"title"?: string,"updated_at"?: string | null,"upload_token"?: string | null,"upload_token_expires_at"?: string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"owner_id"?: string | null,"status"?: string | null,"title"?: string,"updated_at"?: string | null,"upload_token"?: string | null,"upload_token_expires_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wardrobes_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_events": {
                  Row: {
                    "error_message": string | null,"event_type": string,"id": string,"payload": Json | null,"processed_at": string | null,"status": string | null
                  }
                  Insert: {
                    "error_message"?: string | null,"event_type": string,"id"?: string,"payload"?: Json | null,"processed_at"?: string | null,"status"?: string | null
                  }
                  Update: {
                    "error_message"?: string | null,"event_type"?: string,"id"?: string,"payload"?: Json | null,"processed_at"?: string | null,"status"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "assign_wardrobe":
{ Args: { "p_user_id": string,"p_wardrobe_id": string }; Returns: undefined
                           },
"auth_user_id_by_email":
{ Args: { "p_email": string }; Returns: string
                           },
"can_access_wardrobe_object":
{ Args: { "object_name": string }; Returns: boolean
                           },
"check_access":
{ Args: { "check_object_id": string,"check_user_id": string }; Returns: boolean
                           },
"check_rate_limit":
{ Args: { "p_key": string,"p_max": number,"p_window": string }; Returns: boolean
                           },
"get_user_role":
{ Args: { "user_id": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const

