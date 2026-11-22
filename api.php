<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

$host = '91.234.194.126';
$db   = 'c2375154c_dhl-arrivals';
$user = 'c2375154c_dhl-admin';
$pass = 'Msysinfodhl';

$dsn = "mysql:host=$host;dbname=$db;charset=utf8";

try {
    $pdo = new PDO($dsn, $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    if (isset($_GET['action'])) {
        switch ($_GET['action']) {
            case 'list':
                $stmt = $pdo->query("SELECT * FROM arrivals ORDER BY expected_date DESC");
                echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
                break;
            case 'get':
                $stmt = $pdo->prepare("SELECT * FROM arrivals WHERE id = ?");
                $stmt->execute([$_GET['id']]);
                echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
                break;
            case 'history':
                $stmt = $pdo->prepare("SELECT * FROM arrival_history WHERE arrival_id = ? ORDER BY changed_at DESC");
                $stmt->execute([$_GET['id']]);
                echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
                break;
            case 'create':
                $data = json_decode(file_get_contents('php://input'), true);
                $stmt = $pdo->prepare("INSERT INTO arrivals (waybill, dhl_ref, expected_date, status, pieces_count, customs_taxes_duties, customs_payment_date, forwarding_agent_fee, dhl_fee, storage_fee, mci_fee, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([$data['waybill'], $data['dhl_ref'], $data['expected_date'], $data['status'], $data['pieces_count'], $data['customs_taxes_duties'], $data['customs_payment_date'], $data['forwarding_agent_fee'], $data['dhl_fee'], $data['storage_fee'], $data['mci_fee'], $data['currency']]);
                // Log the creation
                $log_stmt = $pdo->prepare("INSERT INTO arrival_history (arrival_id, field_name, old_value, new_value, source, changed_by, note) VALUES (?, ?, ?, ?, ?, ?, ?)");
                // Get the new ID
                $new_id = $pdo->lastInsertId();
                $log_stmt->execute([$new_id, 'creation', NULL, json_encode($data), 'system', 'api_deployment', 'Creation via API deployment']);
                echo json_encode(["success" => true, "id" => $new_id]);
                break;
            case 'update':
                $data = json_decode(file_get_contents('php://input'), true);
                $arrival_id = $data['id'] ?? null;
                // Build the update SET clause dynamically
                $fields = [];
                $values = [];
                foreach ($data as $key => $value) {
                    if ($key !== 'id' && in_array($key, ['waybill', 'dhl_ref', 'expected_date', 'status', 'pieces_count', 'customs_taxes_duties', 'customs_payment_date', 'forwarding_agent_fee', 'dhl_fee', 'storage_fee', 'mci_fee', 'currency'])) {
                        $fields[] = "$key = ?";
                        $values[] = $value;
                    }
                }
                $values[] = $arrival_id;
                $set_clause = implode(', ', $fields);
                $stmt = $pdo->prepare("UPDATE arrivals SET $set_clause WHERE id = ?");
                $stmt->execute($values);
                // Log the changes
                // Get old values first
                $old_stmt = $pdo->prepare("SELECT waybill, status, pieces_count, customs_taxes_duties, forwarding_agent_fee, dhl_fee, storage_fee, mci_fee, currency FROM arrivals WHERE id = ?");
                $old_stmt->execute([$arrival_id]);
                $old_data = $old_stmt->fetch(PDO::FETCH_ASSOC);
                // Log each changed field
                foreach ($data as $key => $new_value) {
                    if (isset($old_data[$key]) && $old_data[$key] !== $new_value && $key !== 'id') {
                        $log_stmt = $pdo->prepare("INSERT INTO arrival_history (arrival_id, field_name, old_value, new_value, source, changed_by, note) VALUES (?, ?, ?, ?, ?, ?, ?)");
                        $log_stmt->execute([$arrival_id, $key, $old_data[$key], $new_value, 'api', 'api_deployment', 'Mise à jour via API']);
                    }
                }
                echo json_encode(["success" => true]);
                break;
            case 'delete':
                $stmt = $pdo->prepare("DELETE FROM arrivals WHERE id = ?");
                $stmt->execute([$_GET['id']]);
                // Log deletion
                $log_stmt = $pdo->prepare("INSERT INTO arrival_history (arrival_id, field_name, old_value, new_value, source, changed_by, note) VALUES (?, ?, ?, ?, ?, ?, ?)");
                $old_stmt = $pdo->prepare("SELECT waybill FROM arrivals WHERE id = ?");
                $old_stmt->execute([$_GET['id']]);
                $old_data = $old_stmt->fetch(PDO::FETCH_ASSOC);
                $log_stmt->execute([$_GET['id'], 'suppression', NULL, $old_data['waybill'], 'api', 'api_deployment', 'Suppression via API']);
                echo json_encode(["success" => true]);
                break;
            case 'loginfo':
                // Get recent history for debugging
                $stmt = $pdo->query("SELECT * FROM arrival_history ORDER BY changed_at DESC LIMIT 20");
                echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
                break;
            default:
                echo json_encode(["status" => "API DHL Arrivals v2.1 - History integrated"]);
                break;
        }
    } else {
        echo json_encode(["status" => "API DHL Arrivals v2.1 - History integrated"]);
    }
} catch (PDOException $e) {
    echo json_encode(["error" => "Database error: " . $e->getMessage()]);
}
?>
