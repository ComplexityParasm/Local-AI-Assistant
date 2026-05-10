$headers = @{
  "Content-Type" = "application/json"
}

$body = @{
  messages = @(
    @{
      role = "user"
      content = "print hello world python"
    }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri "http://localhost:8080/v1/chat/completions" `
  -Method Post `
  -Headers $headers `
  -Body $body