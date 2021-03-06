cmake_minimum_required(VERSION 2.6)
project(voxie)

set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -g -std=c++11 -Wall -fpermissive")
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -g -Wall")

set(SOURCES 
	sources/vox/cube.cpp
)

include_directories(submodules/libla)
include_directories(sources)

add_subdirectory(submodules/libgl4u)
include_directories(submodules/libgl4u/includes)

if(${WIN32})
	include_directories(${SDL2_INCLUDE_DIR})
	include_directories(${GLEW_INCLUDE_DIR})
	link_directories(${SDL2_LINK_DIR})
	link_directories(${GLEW_LINK_DIR})
endif()

add_executable(editor sources/editor_main.cpp ${SOURCES})
add_executable(terrain sources/terrain_main.cpp ${SOURCES})

if(${WIN32})
	set(LIBS mingw32 SDL2main SDL2 opengl32 glew32)
else()
	set(LIBS SDL2 GL GLEW)
endif()

set(LIBS ${LIBS} gl4u)

target_link_libraries(editor ${LIBS})
target_link_libraries(terrain ${LIBS})
