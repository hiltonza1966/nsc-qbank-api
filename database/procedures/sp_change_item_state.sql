delimiter //

DROP PROCEDURE IF EXISTS sp_change_item_state //
CREATE PROCEDURE sp_change_item_state(
    IN p_item_id CHAR(36),
    IN p_new_state VARCHAR(50),
    IN p_user_id INT,
    IN p_ip_address VARCHAR(45),
    IN p_comment TEXT
)
BEGIN
    DECLARE v_current_state VARCHAR(50);
    DECLARE v_valid INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SET @current_user_id = p_user_id, @current_ip = p_ip_address;

    SELECT current_state INTO v_current_state
    FROM item_workflow WHERE item_id = p_item_id FOR UPDATE;

    -- Complete state transition matrix with archive rules
    IF v_current_state = 'draft' AND p_new_state IN ('subject_specialist_review','archived') THEN SET v_valid = 1;
    ELSEIF v_current_state = 'subject_specialist_review' AND p_new_state IN ('peer_approved','revision_required') THEN SET v_valid = 1;
    ELSEIF v_current_state = 'revision_required' AND p_new_state = 'subject_specialist_review' THEN SET v_valid = 1;
    ELSEIF v_current_state = 'peer_approved' AND p_new_state IN ('expert_approved','revision_required') THEN SET v_valid = 1;
    ELSEIF v_current_state = 'expert_approved' AND p_new_state IN ('moderated','revision_required') THEN SET v_valid = 1;
    ELSEIF v_current_state = 'moderated' AND p_new_state IN ('approved','revision_required') THEN SET v_valid = 1;
    ELSEIF v_current_state = 'approved' AND p_new_state IN ('published','archived') THEN SET v_valid = 1;
    ELSEIF v_current_state = 'published' AND p_new_state = 'archived' THEN SET v_valid = 1; -- Retire live items
    ELSEIF v_current_state = 'archived' AND p_new_state = 'draft' THEN SET v_valid = 1; -- Reopen archived items
    END IF;

    IF v_valid = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid state transition';
    END IF;

    UPDATE item_workflow
    SET current_state = p_new_state,
        state_changed_by = p_user_id,
        state_changed_at = NOW(),
        comment = p_comment
    WHERE item_id = p_item_id;

    UPDATE item_master SET status = p_new_state WHERE item_id = p_item_id;

    INSERT INTO item_audit_log (item_id, user_id, action, field_name, old_value, new_value, comment, ip_address, timestamp)
    VALUES (p_item_id, p_user_id, 'state_change', 'current_state',
        v_current_state, p_new_state, p_comment, p_ip_address, NOW());

    COMMIT;
END //

delimiter ;
