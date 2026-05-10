import os

def get_pids_of_executable(executable_name):
    pids = []
    for pid, process in os.Process_iter(['pid', 'name']):
        if process.info['name'] == executable_name:
            pids.append(pid)
    return pids

def scan_local_ips():
    ip_addresses = ["192.168.1.1", "192.168.1.2", "192.168.1.3"]  # Example IP addresses
    results = {}
    for ip in ip_addresses:
        try:
            ports = []
            for port in range(1, 1025):
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                result = sock.connect_ex((ip, port))
                if result == 0:
                    ports.append(port)
            if ports:
                results[ip] = ports
            sock.close()
        except Exception as e:
            print(f"Error scanning {ip}: {e}")
    return results

if __name__ == "__main__":
    executable_name = "cmd.exe"
    pids = get_pids_of_executable(executable_name)
    print(f"PIDs of {executable_name}: {pids}")
    results = scan_local_ips()
    for ip, ports in results.items():
        print(f"IP: {ip}, Ports: {ports}")