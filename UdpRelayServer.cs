using System;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Collections.Generic;

class UdpRelayServer
{
    static void Main()
    {
        UdpClient server = new UdpClient(7777);
        Console.WriteLine("UDP Relay running on port 7777");

        Dictionary<int, IPEndPoint> clients = new();
        int nextId = 1;

        while (true)
        {
            IPEndPoint remote = new IPEndPoint(IPAddress.Any, 0);
            byte[] data = server.Receive(ref remote);

            string msg = Encoding.UTF8.GetString(data);

            if (msg == "join")
            {
                int id = nextId++;
                clients[id] = remote;

                server.Send(Encoding.UTF8.GetBytes($"id:{id}"), 4 + id.ToString().Length, remote);

                foreach (var kv in clients)
                {
                    if (kv.Key != id)
                        server.Send(Encoding.UTF8.GetBytes($"join:{id}"), 5 + id.ToString().Length, kv.Value);
                }

                continue;
            }

            foreach (var kv in clients)
            {
                if (!kv.Value.Equals(remote))
                    server.Send(data, data.Length, kv.Value);
            }
        }
    }
}
