# cycle-ros-example

Experimental [Cycle.js](https://cycle.js.org) [ROS](http://www.ros.org/) [driver](https://cycle.js.org/drivers.html) [implementation](./src/makeROSDriver.js) and its usage [example](./src/index.js).

From the machine with ROS installed and run the following commands in separate terminals:

```
roslaunch rosbridge_server rosbridge_websocket.launch
```

```
rostopic echo /cmd_vel
```

```
rostopic pub -r 1 /listener std_msgs/String "data: 'Hello world!'"
```

```
rosrun rospy_tutorials add_two_ints_server
```

```
rosrun actionlib_tutorials fibonacci_server
```

Make sure you have installed [rosbridge_suite](http://wiki.ros.org/rosbridge_suite), [rospy_tutorials](http://wiki.ros.org/rospy_tutorials), and [actionlib_tutorials](http://wiki.ros.org/actionlib_tutorials) ROS packages installed on the machine.

See [`src/index.js`](src/index.js) for further explanations.